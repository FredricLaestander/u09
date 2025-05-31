import { cn } from '../utils/classname'

export const CardBack = ({
  scale = '100',
}: {
  scale?: '100' | '90' | '80' | '70'
}) => {
  return (
    <div
      className={cn(
        'aspect-[2/3] bg-slate-50 shadow-lg',
        scale === '100' && 'w-40 rounded-xl p-2',
        scale === '90' && 'w-36 rounded-xl p-1.5',
        scale === '80' && 'w-32 rounded-lg p-1.5',
        scale === '70' && 'w-25 rounded-lg p-1.25',
      )}
    >
      <img
        src="/pattern.jpg"
        alt="card back"
        className={cn(
          scale === '100' && 'rounded-sm',
          scale === '90' && 'rounded-sm',
          scale === '80' && 'rounded-xs',
          scale === '70' && 'rounded-xs',
        )}
      />
    </div>
  )
}
