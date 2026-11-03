import { describe, expect, it } from 'vitest';
import { findDateWord, findDateWordInTitle } from './dateWords';

describe('findDateWord', () => {
  it.each(['someday', 'future'])('does not treat "%s" as an undated task shortcut', (word) => {
    expect(findDateWord(`Plan launch ${word}`)).toBeNull();
  });
});

describe('date word false positives', () => {
  it.each([
    'Buy sun cream',
    'Sat down with Alex',
    "Prep for tomorrow's meeting",
    "Review today’s notes",
  ])('ignores everyday words in "%s"', (title) => {
    expect(findDateWord(title)).toBeNull();
  });

  it('still finds full weekday names and tomorrow', () => {
    expect(findDateWord('Call mom sunday')?.word.toLowerCase()).toBe('sunday');
    expect(findDateWord('Pay rent tomorrow')?.word.toLowerCase()).toBe('tomorrow');
  });

  it('only parses the title part, not the note after the first period', () => {
    expect(findDateWordInTitle('Book flights. Leave friday')).toBeNull();
    expect(findDateWordInTitle('Book flights friday. Window seat')?.word.toLowerCase()).toBe('friday');
  });
});
