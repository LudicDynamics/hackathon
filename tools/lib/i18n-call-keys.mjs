import ts from 'typescript';

/** Only the key argument belongs to i18n; interpolation values may contain
 * arbitrary strings (such as text.split('\n')). Parse TS/TSX to separate them. */
export function translationCalls(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = [];
  function keys(node) {
    if (!node) return [];
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return keys(node.expression);
    if (ts.isConditionalExpression(node)) return [...keys(node.whenTrue), ...keys(node.whenFalse)];
    return [];
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      for (const key of keys(node.arguments[0])) found.push({ key, line });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}
