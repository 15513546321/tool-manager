import React from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

interface ConfigDiffViewerProps {
  original: string;
  modified: string;
  language: string;
}

const ConfigDiffViewer: React.FC<ConfigDiffViewerProps> = ({ original, modified, language }) => {
  return (
    <ReactDiffViewer
      oldValue={original}
      newValue={modified}
      splitView={true}
      compareMethod={DiffMethod.WORDS}
      styles={{
        variables: {
          light: {
            diffViewerBackground: '#fff',
            diffViewerColor: '#212529',
            addedBackground: '#e6ffed',
            addedColor: '#24292e',
            removedBackground: '#ffeef0',
            removedColor: '#24292e',
            wordAddedBackground: '#acf2bd',
            wordRemovedBackground: '#fdb8c0',
            addedGutterBackground: '#cdffd8',
            removedGutterBackground: '#ffdce0',
            gutterBackground: '#f7f7f7',
            gutterColor: '#888',
            highlightBackground: '#fffbdd',
            highlightGutterBackground: '#fff5b1',
          },
        },
        line: {
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
        }
      }}
    />
  );
};

export default ConfigDiffViewer;
