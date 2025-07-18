import type { CookieOptions, Response } from 'express'
import { OAuth2Client, type TokenPayload } from 'google-auth-library'
import { sha256 } from 'js-sha256'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { AuthError } from '../lib/error'
import { handle } from '../lib/handle'
import { validate } from '../lib/validate'
import { prisma } from '../prisma/client'

const googleAuthClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `${process.env.BASE_URL}/auth/google/callback`,
})

const googleRedirect = handle(({ res }) => {
  const url = googleAuthClient.generateAuthUrl({
    scope: ['openid', 'profile'],
  })
  res.redirect(url)
})

const googleCallback = handle(async ({ req, res }) => {
  try {
    const code = validate(req.query.code, z.string())

    const { tokens } = await googleAuthClient.getToken(code)
    googleAuthClient.setCredentials(tokens)

    if (!tokens.id_token) {
      throw new AuthError('missing id_token', 401)
    }

    const ticket = await googleAuthClient.verifyIdToken({
      idToken: tokens.id_token,
    })
    const payload = ticket.getPayload()

    if (!payload) {
      throw new AuthError('missing payload', 401)
    }

    const user = await findOrCreateUser(payload)

    await setTokens({ id: user.id, res })
    res.redirect(`${process.env.FRONTEND_URL}`)
  } catch (error) {
    const message = encodeURIComponent(
      error instanceof Error ? error.message : 'authentication failed',
    )
    res.redirect(`${process.env.FRONTEND_URL}/authenticate?error=${message}`)
  }
})

const findOrCreateUser = async (payload: TokenPayload) => {
  const user = await prisma.user.findUnique({
    where: { googleSub: payload.sub },
  })

  if (user) {
    return user
  }

  return await prisma.user.create({
    data: {
      googleSub: payload.sub,
      givenName: payload.given_name,
      statistics: {},
    },
  })
}

const hashToken = (token: string) => {
  const hasher = sha256.create()
  hasher.update(token)
  return hasher.hex()
}

const tokenOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
}

const accessTokenOptions: CookieOptions = {
  ...tokenOptions,
  maxAge: 15 * 60 * 1000, // 15 minutes
}

const refreshTokenOptions: CookieOptions = {
  ...tokenOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}

const setTokens = async ({ id, res }: { id: string; res: Response }) => {
  const accessToken = jwt.sign(
    { id, jwtid: crypto.randomUUID() },
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: '15m',
    },
  )

  const refreshToken = jwt.sign(
    { id, jwtid: crypto.randomUUID() },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: '7d',
    },
  )

  const hashedRefreshToken = hashToken(refreshToken)
  await prisma.refreshToken.create({
    data: { tokenHash: hashedRefreshToken, userId: id },
  })

  res.cookie('access-token', accessToken, accessTokenOptions)
  res.cookie('refresh-token', refreshToken, refreshTokenOptions)
}

const refreshToken = handle(async ({ req, res }) => {
  const refreshToken = validate(
    req.cookies['refresh-token'],
    z.string(),
    'return',
  )

  if (!refreshToken) {
    throw new AuthError('refresh token missing', 401)
  }

  const tokenHash = hashToken(refreshToken)

  if (
    !(await prisma.refreshToken.findUnique({
      where: { tokenHash },
    }))
  ) {
    throw new AuthError('refresh token not found', 401)
  }

  let decodedToken

  try {
    decodedToken = jwt.verify(refreshToken, Bun.env.REFRESH_TOKEN_SECRET!)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'invalid refresh token'

    throw new AuthError(message, 401)
  }

  const { id } = validate(decodedToken, z.object({ id: z.string() }))

  await prisma.refreshToken.delete({ where: { tokenHash } })

  await setTokens({ id, res })
  res.status(200).json({ message: 'token cookies have been set' })
})

const logOut = handle(
  async ({ req, res }) => {
    const rawToken = validate(
      req.cookies['refresh-token'],
      z.string(),
      'return',
    )

    if (rawToken) {
      const tokenHash = hashToken(rawToken)
      await prisma.refreshToken.delete({ where: { tokenHash } })
    }

    res.clearCookie('access-token', accessTokenOptions)
    res.clearCookie('refresh-token', refreshTokenOptions)

    res.status(200).json({ message: 'user logged out' })
  },
  { authenticate: true },
)

export const auth = {
  google: {
    redirect: googleRedirect,
    callback: googleCallback,
  },
  refreshToken,
  logOut,
}
