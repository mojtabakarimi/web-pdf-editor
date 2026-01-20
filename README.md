# PDF Annotator

A professional PDF annotation application built with Electron and PDF.js, featuring a comprehensive ribbon interface similar to PDF-XChange Editor.

## Features

### Viewing Modes
- **Single Page Mode** - View one page at a time with scroll-to-navigate
- **Continuous Mode** - View all pages stacked vertically with seamless scrolling

### Annotation Tools
- **Highlight** - Highlight text and areas
- **Freehand Drawing** - Draw freely on PDF pages
- **Line** - Draw straight lines
- **Rectangle** - Draw rectangular shapes
- **Circle/Ellipse** - Draw circular shapes
- **Text Box** - Add text annotations
- **Comments/Notes** - Add sticky note-style comments

### Annotation Features
- Select and edit annotations
- Edit properties (color, line width, text, font size)
- Delete individual annotations
- Undo last annotation
- Clear page or all annotations
- Properties panel for detailed editing

### View Controls
- Zoom In/Out
- Actual Size (100%)
- Fit Width
- Fit Page
- Page rotation (planned)

### Navigation
- Previous/Next page buttons
- First/Last page navigation
- Scroll-based page navigation in single page mode
- Page indicator

### User Interface
- Professional ribbon interface with tabs (Home, Comment, View, Edit, Forms, Organize)
- Comprehensive menu bar (File, Edit, View, Tools, Help)
- Keyboard shortcuts for all major functions
- Properties panel for annotation editing

## Keyboard Shortcuts

### File
- `Ctrl+O` - Open PDF
- `Ctrl+S` - Save (to be implemented)
- `Ctrl+W` - Close PDF

### Edit
- `Ctrl+Z` - Undo last annotation
- `Delete` - Delete selected annotation
- `Ctrl+Shift+C` - Clear page annotations

### View
- `Ctrl++` - Zoom In
- `Ctrl+-` - Zoom Out
- `Ctrl+0` - Actual Size
- `Ctrl+1` - Fit Width
- `Ctrl+2` - Fit Page

### Tools
- `V` - Select Tool
- `H` - Hand Tool (planned)
- `1` - Highlight
- `2` - Freehand
- `3` - Line
- `4` - Rectangle
- `5` - Ellipse
- `T` - Text Box
- `N` - Note/Comment

### Help
- `F1` - Keyboard Shortcuts
- `F12` - Toggle Properties Panel

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

```bash
npm start
```

## Project Structure

```
pdf-annotator/
├── index.html          # Main HTML file with UI
├── main.js            # Electron main process
├── preload.js         # Preload script for IPC
├── renderer.js        # Renderer process (main application logic)
├── pdfjs/             # PDF.js library files
├── node_modules/      # Dependencies
├── package.json       # Project configuration
└── .gitignore        # Git ignore file
```

## Technologies Used

- **Electron** - Desktop application framework
- **PDF.js** - PDF rendering engine (v4.0.379)
- **HTML5 Canvas** - For PDF rendering and annotations
- **JavaScript (ES6)** - Application logic

## Development

The application uses:
- ES6 modules for PDF.js integration
- Canvas-based rendering for PDF and annotations
- Separate canvas layers for PDF content and annotations
- Event-driven architecture for tool selection and annotation
- IPC communication between main and renderer processes

## Version

1.0.0

## License

MIT

## Author

Built with Claude Code
