import { Router } from 'express'
import { auth as authController } from '../controllers/auth'
import { statistics as statisticsController } from '../controllers/statistics'
import { user } from '../controllers/user'

const auth = Router()
auth.get('/google', authController.google.redirect)
auth.get('/google/callback', authController.google.callback)
auth.get('/refresh-token', authController.refreshToken)
auth.delete('/log-out', authController.logOut)

const users = Router()
users.get('/me', user.getMe)
users.put('/me', user.update)
users.delete('/me', user.delete)

const statistics = Router()
statistics.put('/', statisticsController.update)

export const router = Router()
router.use('/auth', auth)
router.use('/users', users)
router.use('/statistics', statistics)
