import React from 'react'

import { AppPage } from '../components/AppPage'
import { MonacoEditor, MonacoUpdateEventPackage } from '../components/MonacoEditor'
import { GeneratorTargetsChooser } from '../components/GeneratorTargetsChooser'
import { PannelTitle } from '../components/PannelTitle'
import { PreviewFrame } from '../components/PreviewFrame'
import { JsonInputChooser } from '../components/JsonInputChooser'

import loadWrapper from '../utils/teleportWrapper'
import uildValidator from '../utils/uildValidator'

import { generateComponent as generateReactComponent } from '../utils/experimental-generators/react'
import { generateComponent as generateVueComponent } from '../utils/experimental-generators/vue'

import { loadJSONAsync, exmaplesList } from '../inputs'
import test1 from '../inputs/test'

// TODO move into utils file
const postData = (url: string = ``, data: string = ``) => {
  // Default options are marked with *
  return (
    fetch(url, {
      body: data, // body data type must match "Content-Type" header
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      mode: 'cors', // no-cors, cors, *same-origin
      redirect: 'follow', // manual, *follow, error
      referrer: 'no-referrer', // no-referrer, *client
    })
      .then((response) => response.json())
      // tslint:disable-next-line:no-console
      .catch((err) => console.error(err))
  ) // parses response to JSON
}
interface PlaygroundPageState {
  generatedCode: string
  targetLibrary: string
  inputJson: string
  sourceJSON: string
}

export default class PlaygroundPage extends React.Component<{}, PlaygroundPageState> {
  public state: PlaygroundPageState = {
    generatedCode: '',
    inputJson: '',
    targetLibrary: 'react-ast',
    sourceJSON: exmaplesList[0],
  }

  public codeEditorRef = React.createRef<MonacoEditor>()

  public handleGeneratorTypeChange = (ev: { target: { value: string } }) => {
    this.setState({ targetLibrary: ev.target.value }, this.handleInputChange)
  }

  public handleJSONUpdate = (updateEvent: MonacoUpdateEventPackage) => {
    if (!updateEvent.value) {
      return false
    }

    this.setState({ inputJson: updateEvent.value }, this.handleInputChange)
  }

  public handleInputChange = async () => {
    const { targetLibrary, inputJson } = this.state
    let jsonValue: any = null

    try {
      jsonValue = JSON.parse(inputJson)
    } catch (err) {
      return
    }

    const validationResult = uildValidator(jsonValue)
    if (validationResult !== true) {
      // tslint:disable-next-line:no-console
      console.error(validationResult)
      return
    }

    switch (targetLibrary) {
      case 'react-ast':
        try {
          const code = await generateReactComponent(jsonValue)
          this.setState(
            {
              generatedCode: code.toString(),
            },
            () => {
              postData(this.getPreviewerUrl() + '/preview', code.toString())
            }
          )
        } catch (err) {
          // tslint:disable-next-line:no-console
          console.error('generateReactComponent', err)
        }
        return

      case 'vue-ast':
        try {
          const code = await generateVueComponent(jsonValue)
          this.setState(
            {
              generatedCode: code,
            },
            () => {
              postData(this.getPreviewerUrl() + '/preview', code)
            }
          )
        } catch (err) {
          // tslint:disable-next-line:no-console
          console.error('generateVueComponent', err)
        }
        return
    }

    loadWrapper().then((wrapper) => {
      const result = wrapper.generateComponent(jsonValue, targetLibrary)
      const fileName = result.getFileNames()[0]

      const generatedCode = result.getContent(fileName)

      if (!generatedCode) {
        return
      }

      this.setState(
        {
          generatedCode,
        },
        () => {
          postData(this.getPreviewerUrl() + '/preview', generatedCode)
        }
      )
    })
  }

  public handleJSONChoose = (ev: { target: { value: string } }) => {
    const newValue = ev.target.value
    loadJSONAsync(newValue)
      .then((value) => {
        if (this.codeEditorRef && this.codeEditorRef.current) {
          this.codeEditorRef.current.setValue(JSON.stringify(value, null, 2))
          this.setState({ sourceJSON: newValue })
        }
      })
      // tslint:disable-next-line:no-console
      .catch((err) => console.error(err))
  }

  public getPreviewerUrl() {
    switch (this.state.targetLibrary) {
      case 'react':
      case 'react-ast':
        return 'http://localhost:3031'
      case 'vue':
      case 'vue-ast':
        return 'http://localhost:3032'
      default:
        // tslint:disable-next-line:no-console
        console.error('no matching previwer found for', this.state.targetLibrary)
        return 'http://localhost:9999'
    }
  }

  public render() {
    return (
      <AppPage>
        <div className="main-content">
          <style jsx>{`
            .main-content {
              display: flex;
              width: 100%;
              height: 100%;
            }

            .results-container {
              display: flex;
              flex-flow: column;
              flex: 1;
            }

            .live-view-container {
              flex: 1;
            }

            .code-view-container {
              flex: 2;
            }

            .json-input-container {
              flex: 1;
            }

            .generators-target-type {
              background-color: #1e1e1e;
              padding: 8px;
            }
          `}</style>

          <div className="json-input-container">
            <PannelTitle>
              Input json:
              <JsonInputChooser
                options={exmaplesList}
                value={this.state.sourceJSON}
                onChoose={this.handleJSONChoose}
              />
            </PannelTitle>
            <MonacoEditor
              ref={this.codeEditorRef}
              name="json-editor"
              value={JSON.stringify(test1, null, 2)}
              onMessage={this.handleJSONUpdate}
            />
          </div>

          <div className="results-container">
            <div className="generators-target-type">
              <GeneratorTargetsChooser
                onChoose={this.handleGeneratorTypeChange}
                value={this.state.targetLibrary}
              />
              <button>Refresh All</button>
              <button>Refresh Code</button>
              <button>Refresh Project</button>
            </div>
            <PannelTitle>Running app with generated code</PannelTitle>
            <div className="live-view-container">
              <PreviewFrame url={this.getPreviewerUrl()} />
            </div>
            <div className="code-view-container">
              <PannelTitle>Generated code</PannelTitle>
              <MonacoEditor
                name="code-preview"
                language="javascript"
                value={this.state.generatedCode}
                readOnly
              />
            </div>
          </div>
        </div>
      </AppPage>
    )
  }
}
