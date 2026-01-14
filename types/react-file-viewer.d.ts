declare module 'react-file-viewer' {
  import React from 'react';

  export interface FileViewerProps {
    fileType: string;
    filePath: string;
    errorComponent?: React.ReactNode;
    onError?: (error: Error) => void;
    onLoad?: (event: Event) => void;
  }

  export const FileViewer: React.FC<FileViewerProps>;
  export default FileViewer;
}