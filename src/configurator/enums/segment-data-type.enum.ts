// The data type of a SegmentDefinition, controlling which constraints shape
// applies (see StringConstraints / NumberConstraints) and which condition
// operators may target it.
export enum SegmentDataType {
  STRING = 'string',
  NUMBER = 'number',
  SELECT = 'select',
}
