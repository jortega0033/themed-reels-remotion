import {DEFAULT_SPEC} from '../defaultSpec';
import {RenderSpecInput} from '../types/schema';

export const coerceRenderSpecInput = (
  value: RenderSpecInput | Record<string, unknown> | undefined,
): RenderSpecInput => {
  if (!value || Object.keys(value as Record<string, unknown>).length === 0) {
    return DEFAULT_SPEC;
  }

  if (Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const hasNumericKeys = Object.keys(record).some((key) => /^\d+$/.test(key));
  const hasConfigShape = 'config' in record && 'timeline' in record && 'assets' in record;

  if (hasNumericKeys && !hasConfigShape) {
    const arrayified = Object.keys(record)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => record[key]) as RenderSpecInput;

    if (arrayified.length > 0) {
      return arrayified;
    }
  }

  return value as RenderSpecInput;
};
