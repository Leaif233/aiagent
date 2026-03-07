import { CheckCircle2, Circle, XCircle, Loader2 } from 'lucide-react'

interface Props {
  currentStatus: string
  entityType: 'ticket' | 'doc'
}

const TICKET_STEPS = ['待处理', 'AI清洗中', '待审核', '索引构建中', '已审核']
const DOC_STEPS = ['待处理', '解析中', '待审核', '索引构建中', '已审核']
const ERROR_STATUSES = ['处理失败', '已驳回']

export default function ProgressFunnel({ currentStatus, entityType }: Props) {
  const steps = entityType === 'ticket' ? TICKET_STEPS : DOC_STEPS
  const isError = ERROR_STATUSES.includes(currentStatus)
  const currentIdx = steps.indexOf(currentStatus)

  return (
    <div className="flex items-center gap-1 py-3">
      {steps.map((step, i) => {
        const done = currentIdx > i
        const active = currentIdx === i && !isError
        const icon = done
          ? <CheckCircle2 size={16} className="text-green-500" />
          : active
            ? <Loader2 size={16} className="text-blue-500 animate-spin" />
            : <Circle size={16} className="text-gray-300" />

        return (
          <div key={step} className="flex items-center">
            {i > 0 && (
              <div className={`w-6 h-0.5 mx-0.5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              {icon}
              <span className={`text-[10px] whitespace-nowrap ${
                done ? 'text-green-600 font-medium'
                  : active ? 'text-blue-600 font-medium'
                    : 'text-gray-400'
              }`}>
                {step}
              </span>
            </div>
          </div>
        )
      })}

      {isError && (
        <div className="flex items-center">
          <div className="w-6 h-0.5 mx-0.5 bg-red-300" />
          <div className="flex flex-col items-center gap-0.5">
            <XCircle size={16} className="text-red-500" />
            <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">
              {currentStatus}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
