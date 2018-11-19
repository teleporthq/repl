import * as types from '@babel/types'

export const makeConstAssign = (constName: string, asignment = null, t = types) => {
  const declarator = t.variableDeclarator(t.identifier(constName), asignment)
  const constAsignment = t.variableDeclaration('const', [declarator])
  return constAsignment
}

export const makeDefaultExport = (name: string, t = types) => {
  return t.exportDefaultDeclaration(t.identifier(name))
}

export const makeJSSDefaultExport = (
  componentName: string,
  stylesName: string,
  t = types
) => {
  return t.exportDefaultDeclaration(
    t.callExpression(
      t.callExpression(t.identifier('injectSheet'), [t.identifier(stylesName)]),
      [t.identifier(componentName)]
    )
  )
}

export const makeDefaultImportStatement = (
  specifier: string,
  source: string,
  t = types
) => {
  return t.importDeclaration(
    [t.importDefaultSpecifier(t.identifier(specifier))],
    t.stringLiteral(source)
  )
}

export const makeNamedImportStatement = (
  specifiers: string[],
  source: string,
  t = types
) => {
  return t.importDeclaration(
    specifiers.map((specifier) =>
      t.importSpecifier(t.identifier(specifier), t.identifier(specifier))
    ),
    t.stringLiteral(source)
  )
}

/**
 * You pass in a object like { 'a': 'b', 'foo': 'bar' } and get back a AST statement
 * like "import { a as b, foo as bar } from '...'"
 *
 * @param specifiers
 * @param source
 * @param t
 */
export const makeNamedMappedImportStatement = (
  specifiers: { [key: string]: string },
  source: string,
  t = types
) => {
  return t.importDeclaration(
    Object.keys(specifiers).reduce((acc: any[], specifierKey: string) => {
      acc.push(
        t.importSpecifier(
          t.identifier(specifiers[specifierKey]),
          t.identifier(specifierKey)
        )
      )
      return acc
    }, []),
    t.stringLiteral(source)
  )
}
