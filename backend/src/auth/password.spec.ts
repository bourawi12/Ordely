import { PASSWORD_RULE } from './password';

describe('PASSWORD_RULE', () => {
  it('accepts a password with every kind of character', () => {
    expect(PASSWORD_RULE.test('Str0ng!pass')).toBe(true);
    // Accented letters count as letters, not as the special character.
    expect(PASSWORD_RULE.test('Été2026#')).toBe(true);
  });

  it.each([
    ['no uppercase letter', 'str0ng!pass'],
    ['no lowercase letter', 'STR0NG!PASS'],
    ['no number', 'Strong!pass'],
    ['no special character', 'Str0ngpass'],
    ['only a space as special character', 'Str0ng pass'],
    ['only an accented letter as special character', 'Str0ngpassé'],
  ])('refuses a password with %s', (_case, password) => {
    expect(PASSWORD_RULE.test(password)).toBe(false);
  });
});
