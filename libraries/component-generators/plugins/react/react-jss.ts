import * as t from '@babel/types'

import { ComponentPlugin, ComponentPluginFactory } from '../../pipeline/types'
import { ComponentContent } from '../../../uidl-definitions/types'
import { addDynamicPropOnJsxOpeningTag } from '../../pipeline/utils/jsx-ast'
import {
  ParsedASTNode,
  makeConstAssign,
  makeJSSDefaultExport,
  objectToObjectExpression,
} from '../../pipeline/utils/js-ast'

import { cammelCaseToDashCase } from '../../pipeline/utils/helpers'

const prepareDynamicProps = (style: any) => {
  return Object.keys(style).reduce((acc: any, key) => {
    const value = style[key]
    if (typeof value === 'string' && value.startsWith('$props.')) {
      acc[key] = new ParsedASTNode(
        t.arrowFunctionExpression(
          [t.identifier('props')],
          t.memberExpression(
            t.identifier('props'),
            t.identifier(value.replace('$props.', ''))
          )
        )
      )
    } else {
      acc[key] = style[key]
    }
    return acc
  }, {})
}

const generateStyleTagStrings = (
  content: ComponentContent,
  nodesLookup: Record<string, t.JSXElement>
) => {
  let accumulator: { [key: string]: any } = {}

  const { style, children, key } = content
  if (style) {
    const root = nodesLookup[key]
    const className = cammelCaseToDashCase(key)
    accumulator[className] = prepareDynamicProps(style)
    // addClassStringOnJSXTag(root.node, className)
    addDynamicPropOnJsxOpeningTag(root, 'className', `classes['${className}']`, 'props')
  }

  if (children) {
    children.forEach((child) => {
      if (typeof child === 'string') {
        return
      }

      // only call on children if they are not strings
      const items = generateStyleTagStrings(child, nodesLookup)
      accumulator = {
        ...accumulator,
        ...items,
      }
    })
  }

  return accumulator
}

interface JSSConfig {
  styleChunkName?: string
  importChunkName?: string
  componentChunkName: string
  exportChunkName: string
  jssDeclarationName?: string
}
export const createPlugin: ComponentPluginFactory<JSSConfig> = (config) => {
  const {
    componentChunkName = 'react-component',
    importChunkName = 'import',
    styleChunkName = 'jss-style-definition',
    exportChunkName = 'export',
    jssDeclarationName = 'style',
  } = config || {}

  const reactJSSComponentStyleChunksPlugin: ComponentPlugin = async (
    structure,
    operations
  ) => {
    const { uidl, chunks } = structure
    const { registerDependency } = operations

    const { content } = uidl

    const componentChunk = chunks.find((chunk) => chunk.name === componentChunkName)
    if (!componentChunk) {
      return structure
    }

    const jsxNodesLookup = componentChunk.meta.nodesLookup

    const jssStyleMap = generateStyleTagStrings(content, jsxNodesLookup)

    if (!Object.keys(jssStyleMap).length) {
      // if no styles are defined, no need to build the jss style at all
      return structure
    }

    registerDependency('injectSheet', {
      type: 'library',
      path: 'react-jss',
      version: '8.6.1',
    })

    chunks.push({
      type: 'js',
      name: styleChunkName,
      linker: {
        after: [importChunkName],
      },
      content: makeConstAssign(jssDeclarationName, objectToObjectExpression(jssStyleMap)),
    })

    const exportChunk = chunks.find((chunk) => chunk.name === exportChunkName)

    const exportStatement = makeJSSDefaultExport(uidl.name, jssDeclarationName)

    if (exportChunk) {
      exportChunk.content = exportStatement
      if (exportChunk.linker && exportChunk.linker.after) {
        exportChunk.linker.after.push(styleChunkName)
      } else {
        exportChunk.linker = exportChunk.linker || {}
        exportChunk.linker.after = [importChunkName, styleChunkName]
      }
    } else {
      chunks.push({
        type: 'js',
        name: exportChunkName,
        content: exportStatement,
        linker: {
          after: [importChunkName, styleChunkName],
        },
      })
    }

    return structure
  }

  return reactJSSComponentStyleChunksPlugin
}

export default createPlugin()