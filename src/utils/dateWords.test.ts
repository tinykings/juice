import { describe, expect, it } from 'vitest';
import { findDateWord } from './dateWords';

describe('findDateWord', () => {
  it.each(['someday', 'future'])('does not treat "%s" as an undated task shortcut', (word) => {
    expect(findDateWord(`Plan launch ${word}`)).toBeNull();
  });
});
