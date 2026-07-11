import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from '../input'

describe('Input', () => {
  it.each([
    ['tel', 'tel', 'tel'],
    ['email', 'email', 'email'],
    ['url', 'url', 'url'],
    ['number', 'numeric', null],
    ['search', 'search', null],
  ])('derives mobile attributes for %s inputs', (type, inputMode, autoComplete) => {
    render(<Input aria-label={type} type={type} />)

    const input = screen.getByLabelText(type)
    expect(input).toHaveAttribute('inputmode', inputMode)
    if (autoComplete) expect(input).toHaveAttribute('autocomplete', autoComplete)
  })

  it('honors forced attributes and forwards its ref', () => {
    const ref = createRef<HTMLInputElement>()
    render(
      <Input
        ref={ref}
        aria-label="custom"
        type="email"
        inputMode="decimal"
        autoComplete="off"
      />,
    )

    expect(ref.current).toBe(screen.getByLabelText('custom'))
    expect(ref.current).toHaveAttribute('inputmode', 'decimal')
    expect(ref.current).toHaveAttribute('autocomplete', 'off')
  })

  it.each([
    ['sm', 'h-9'],
    ['default', 'h-11'],
    ['lg', 'h-12'],
  ] as const)('applies the %s size', (size, className) => {
    render(<Input aria-label={size} size={size} />)
    expect(screen.getByLabelText(size)).toHaveClass(className)
  })

  it('renders both icons and an accessible error message', () => {
    render(
      <Input
        aria-label="invalid"
        error
        errorMessage="Required field"
        leftIcon={<span>left</span>}
        rightIcon={<span>right</span>}
      />,
    )

    const input = screen.getByLabelText('invalid')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveClass('pl-10', 'pr-10', 'border-destructive')
    expect(screen.getByText('left')).toBeInTheDocument()
    expect(screen.getByText('right')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Required field')
  })

  it('wraps for a dormant error message without displaying it', () => {
    const { container } = render(
      <Input aria-label="valid" error={false} errorMessage="Hidden message" />,
    )

    expect(screen.getByLabelText('valid')).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText('Hidden message')).not.toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('relative')
  })
})
