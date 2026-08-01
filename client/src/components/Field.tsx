import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface CommonProps {
  label?: string
  hint?: string
  error?: string | null
  counter?: string
  className?: string
  id?: string
}

interface SingleLineProps extends CommonProps, Omit<InputHTMLAttributes<HTMLInputElement>, keyof CommonProps> {
  multiline?: false
  inputSize?: 'lg' | 'md'
  code?: boolean
}

interface MultilineProps extends CommonProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof CommonProps> {
  multiline: true
  rows?: number
}

type Props = SingleLineProps | MultilineProps

/** Pilule sur une ligne — puits (ink-2) plutôt que carte, pour se creuser sous le panneau qui
 * l'entoure. En multiligne (question de quiz), sort de la pilule : --radius-md, réservée aux
 * contrôles courts. */
export function Field(props: Props) {
  const { label, hint, error, counter, className = '', id } = props
  const bad = Boolean(error)

  const labelEl = label && (
    <label htmlFor={id} className="px-1 text-xs font-semibold uppercase tracking-[1.2px] text-muted">
      {label}
    </label>
  )
  const footer = (error || hint || counter) && (
    <div className="flex justify-between gap-3 px-5">
      <span className={`text-sm ${bad ? 'text-coral' : 'text-muted-soft'}`}>{error || hint}</span>
      {counter && <span className="flex-none text-sm text-muted-soft">{counter}</span>}
    </div>
  )
  const borderClass = bad ? 'border-coral' : 'border-line-strong'

  if (props.multiline) {
    const { multiline: _multiline, rows = 3, label: _l, hint: _h, error: _e, counter: _c, className: _cn, id: _id, ...rest } = props
    return (
      <div className="flex w-full flex-col gap-2">
        {labelEl}
        <textarea
          id={id}
          rows={rows}
          className={`w-full resize-y rounded-md border-[1.5px] bg-ink-2 px-6 py-4 text-base font-medium text-cream outline-none transition placeholder:text-muted-deep focus:border-citron/60 ${borderClass} ${className}`}
          {...rest}
        />
        {footer}
      </div>
    )
  }

  const {
    multiline: _multiline2,
    inputSize = 'md',
    code = false,
    label: _l2,
    hint: _h2,
    error: _e2,
    counter: _c2,
    className: _cn2,
    id: _id2,
    ...rest
  } = props
  return (
    <div className="flex w-full flex-col gap-2">
      {labelEl}
      <input
        id={id}
        className={`w-full rounded-full border-[1.5px] bg-ink-2 px-6 text-cream outline-none transition placeholder:text-muted-deep focus:border-citron/60 ${borderClass} ${
          inputSize === 'lg' ? 'h-[60px] text-lg' : 'h-14 text-base'
        } ${code ? 'font-display tracking-[3px]' : 'font-medium'} ${className}`}
        {...rest}
      />
      {footer}
    </div>
  )
}
