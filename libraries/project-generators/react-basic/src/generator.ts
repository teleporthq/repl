import reactProjectMapping from './elements-mapping.json'
import customMapping from './custom-mapping.json'

import { configureRouterAsemblyLine } from '../../../component-generators/react/react-router'
import configureAssemblyLine, {
  ReactComponentFlavors,
} from '../../../component-generators/react/react-component'

import { extractExternalDependencies } from '../../utils/generator-utils'

import { File, Folder, ProjectGeneratorOptions } from '../../types'
import { ProjectUIDL } from '../../../uidl-definitions/types'

const componentGenerator = configureAssemblyLine({
  variation: ReactComponentFlavors.CSSModules,
})

const routingComponentGenerator = configureRouterAsemblyLine()

const extractInlineComponent = (root: Record<string, any>) => {
  const { components, states } = Object.keys(root.states).reduce(
    (acc: any, stateKey) => {
      const state = root.states[stateKey]
      // if component has content declared in root
      if (state.component.content.children) {
        // push new component in
        acc.components[state.component.name] = {
          ...state.component,
          type: state.component.name,
        }

        // modify state to contain local dependecy
        acc.states[stateKey] = {
          ...state,
          component: {
            name: state.component.name,
            content: {
              type: state.component.name,
              name: state.component.name,
              dependency: {
                type: 'local',
                path: `./${state.component.name}`,
              },
            },
          },
        }
      } else {
        acc.states[stateKey] = state
      }

      return acc
    },
    { states: {}, components: {} }
  )

  return { components, states }
}

export default async (
  jsDoc: ProjectUIDL,
  { sourcePackageJson, distPath = 'dist' }: ProjectGeneratorOptions = {
    distPath: 'dist',
  }
) => {
  // pick root name/id

  const { components, root } = jsDoc

  const componentsFolder: Folder = {
    name: 'components',
    files: [],
    subFolders: [],
  }

  const srcFolder: Folder = {
    name: 'src',
    files: [],
    subFolders: [componentsFolder],
  }

  const distFolder: Folder = {
    name: distPath,
    files: [],
    subFolders: [srcFolder],
  }

  let allDependencies: Record<string, any> = {}

  const { components: newComponents, states } = extractInlineComponent(root)
  const allComponents = {
    ...components,
    ...newComponents,
  }

  // Handle the router first
  const routingComponent = await routingComponentGenerator({
    ...root,
    states,
  })

  srcFolder.files.push({
    name: 'index',
    extension: '.js',
    content: routingComponent.code,
  })

  allDependencies = {
    ...allDependencies,
    ...routingComponent.dependencies,
  }

  const componentMappings = { ...reactProjectMapping, ...customMapping }

  const generatedComponentFileGroups: File[][] = await Promise.all(
    Object.keys(allComponents).map(async (componentName) => {
      const component = allComponents[componentName]
      const compiledComponent = await componentGenerator(component, {
        customMapping: componentMappings,
      })

      let cssFile: File | null = null
      if (compiledComponent.css) {
        cssFile = {
          name: component.name,
          extension: '.css',
          content: compiledComponent.css,
        }
      }

      const jsFile: File = {
        name: component.name,
        extension: '.js',
        content: compiledComponent.code,
      }

      allDependencies = {
        ...allDependencies,
        ...compiledComponent.dependencies,
      }

      if (cssFile) {
        return [jsFile, cssFile]
      }
      return [jsFile]
    })
  )

  const generatedComponentsFiles = generatedComponentFileGroups.reduce(
    (files: File[], fileGroup) => {
      files.push(...fileGroup)
      return files
    },
    []
  )

  componentsFolder.files.push(...generatedComponentsFiles)

  // Package.json
  if (sourcePackageJson) {
    const externalDep = extractExternalDependencies(allDependencies)

    sourcePackageJson.dependencies = {
      ...sourcePackageJson.dependencies,
      ...externalDep,
    }

    const packageFile: File = {
      name: 'package',
      extension: '.json',
      content: JSON.stringify(sourcePackageJson, null, 2),
    }

    distFolder.files.push(packageFile)
  }

  return distFolder
}