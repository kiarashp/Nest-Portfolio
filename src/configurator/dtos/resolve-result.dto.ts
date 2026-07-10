import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// One validation failure for one segment, keyed by assignment id so the
// frontend can anchor the message to its input.
export class ResolveErrorDto {
  // assignmentId — the segment the error belongs to
  @ApiProperty({ example: 15 })
  assignmentId!: number

  // message — user-displayable, includes the segment's label
  @ApiProperty({ example: '"Insertion length (mm)" must be at most 2000' })
  message!: string
}

// The resolved state of one segment, returned on every resolve call (valid
// or not) so the frontend can render per-segment UI state.
export class ResolveSegmentStateDto {
  // assignmentId
  @ApiProperty({ example: 11 })
  assignmentId!: number

  // position — 1-based code/display order
  @ApiProperty({ example: 1 })
  position!: number

  // active — false means the segment was zero-filled by its condition
  @ApiProperty({ example: true })
  active!: boolean

  // value — the resolved (normalized or zero-fill) value; for an errored
  // segment this echoes the raw input, or '' when no value was supplied
  @ApiProperty({
    example: '2d',
    description:
      'Resolved (normalized/zero-filled) value; echoes the raw input or is empty when the segment errored',
  })
  value!: string
}

// Response body for POST /configurators/:slug/resolve (CONFIGURATOR.md §4.3).
export class ResolveResultDto {
  // valid — true when every active segment passed validation
  @ApiProperty({ example: true })
  valid!: boolean

  // errors — every collected validation failure; empty when valid
  @ApiProperty({ type: [ResolveErrorDto] })
  errors!: ResolveErrorDto[]

  // code — the composed ordering code; present only when valid
  @ApiPropertyOptional({
    example: 'FRH-2d-no-00-000-0450',
    description: 'Present only when valid',
  })
  code?: string

  // summary — one rendered line per ACTIVE segment (zero-filled segments are
  // omitted); present only when valid
  @ApiPropertyOptional({
    type: [String],
    description: 'Present only when valid; zero-filled segments are omitted',
  })
  summary?: string[]

  // segments — per-segment resolved state, always present
  @ApiProperty({ type: [ResolveSegmentStateDto] })
  segments!: ResolveSegmentStateDto[]
}
