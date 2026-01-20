const { ipcRenderer } = require('electron');

window.electronAPI = {
  openFile: () => ipcRenderer.invoke('dialog:openFile')
};
