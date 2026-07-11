import { describe, expect, it } from 'vitest'
import {
  mediaLightboxShellDialogClassName,
  shellDialogContentClassName,
  shellDialogSizes,
} from '../shell-dialog-classes'

describe('shellDialogContentClassName', () => {
  it('defaults to lg desktop max-width', () => {
    const className = shellDialogContentClassName()
    expect(className).toContain(shellDialogSizes.lg)
    expect(className).toContain('max-sm:h-[100dvh]')
    expect(className).toContain('sm:rounded-lg')
  })

  it('applies the requested size preset', () => {
    expect(shellDialogContentClassName({ size: 'sm' })).toContain(
      shellDialogSizes.sm,
    )
    expect(shellDialogContentClassName({ size: 'xl' })).toContain(
      shellDialogSizes.xl,
    )
  })
})

describe('mediaLightboxShellDialogClassName', () => {
  it('uses fullscreen black shell with desktop overrides', () => {
    expect(mediaLightboxShellDialogClassName).toContain('bg-black')
    expect(mediaLightboxShellDialogClassName).toContain('h-[100dvh]')
    expect(mediaLightboxShellDialogClassName).toContain('sm:max-w-5xl')
  })
})
