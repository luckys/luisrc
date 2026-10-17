import type { ButtonHTMLAttributes } from 'react'

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean
}

export function ActionButton({
  pending = false,
  disabled,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? 'Guardando…' : children}
    </button>
  )
}

export function DeliveryTable({
  rows,
}: {
  rows: readonly { id: string; name: string }[]
}) {
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Tabla de entregas"
    >
      <table>
        <caption>Entregas de la página actual</caption>
        <thead>
          <tr>
            <th scope="col">Identificador</th>
            <th scope="col">Descripción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.id}</th>
              <td>{row.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
