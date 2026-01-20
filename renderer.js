import * as pdfjsLib from './pdfjs/build/pdf.mjs';

const fs = window.require('fs');
const path = window.require('path');

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/build/pdf.worker.mjs';

// DOM elements
const placeholder = document.getElementById('placeholder');
const fileInfo = document.getElementById('file-info');
const pdfContainer = document.getElementById('pdf-container');
const pdfCanvas = document.getElementById('pdf-canvas');
const annotationCanvas = document.getElementById('annotation-canvas');
const pageControls = document.getElementById('page-controls');
const pageInfo = document.getElementById('page-info');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomLevel = document.getElementById('zoom-level');

// Ribbon elements
const ribbonTabs = document.querySelectorAll('.ribbon-tab');
const ribbonContents = document.querySelectorAll('.ribbon-content');

// Tool buttons
const toolSelect = document.getElementById('tool-select');
const toolHighlight = document.getElementById('tool-highlight');
const toolDraw = document.getElementById('tool-draw');
const toolLine = document.getElementById('tool-line');
const toolCircle = document.getElementById('tool-circle');
const toolBox = document.getElementById('tool-box');
const toolComment = document.getElementById('tool-comment');
const toolText = document.getElementById('tool-text');
const toolClear = document.getElementById('tool-clear');
const toolUndo = document.getElementById('tool-undo');
const colorPicker = document.getElementById('color-picker');
const lineWidth = document.getElementById('line-width');

// Properties panel elements
const propertiesPanel = document.getElementById('properties-panel');
const propType = document.getElementById('prop-type');
const propColor = document.getElementById('prop-color');
const propLineWidth = document.getElementById('prop-line-width');
const propText = document.getElementById('prop-text');
const propFontSize = document.getElementById('prop-font-size');
const propTextGroup = document.getElementById('prop-text-group');
const propFontSizeGroup = document.getElementById('prop-font-size-group');
const propLineWidthGroup = document.getElementById('prop-line-width-group');
const propDelete = document.getElementById('prop-delete');
const propClose = document.getElementById('prop-close');

// PDF state
let pdfDoc = null;
let currentPage = 1;
let scale = 1.5;
let currentTool = 'select';
let viewMode = 'single'; // 'single' or 'continuous'

// Annotation state
let annotations = [];
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentPath = [];
let selectedAnnotation = null;

// Canvas contexts
const pdfCtx = pdfCanvas.getContext('2d');
const annotationCtx = annotationCanvas.getContext('2d');

// Load and render PDF
async function loadPDF(filePath) {
  try {
    console.log('Loading PDF from:', filePath);
    const data = new Uint8Array(fs.readFileSync(filePath));
    console.log('PDF data loaded, size:', data.length);

    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    console.log('PDF document loaded, pages:', pdfDoc.numPages);

    // Show UI elements
    placeholder.style.display = 'none';
    pdfContainer.classList.add('visible');
    pageControls.classList.add('visible');

    // Display file name
    const fileName = path.basename(filePath);
    fileInfo.textContent = `${fileName}`;

    // Render first page
    await renderPage(currentPage);
  } catch (error) {
    console.error('Error loading PDF:', error);
    alert('Failed to load PDF file: ' + error.message);
  }
}

// Render PDF page (single page mode)
async function renderPage(pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  // Set canvas dimensions
  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;
  annotationCanvas.width = viewport.width;
  annotationCanvas.height = viewport.height;

  // Render PDF page
  const renderContext = {
    canvasContext: pdfCtx,
    viewport: viewport
  };
  await page.render(renderContext).promise;

  // Redraw annotations
  redrawAnnotations();

  // Update page info
  pageInfo.textContent = `Page ${pageNum} / ${pdfDoc.numPages}`;
  prevPageBtn.disabled = pageNum === 1;
  nextPageBtn.disabled = pageNum === pdfDoc.numPages;
}

// Render all pages (continuous mode)
async function renderContinuous() {
  const continuousContainer = document.getElementById('continuous-container');
  continuousContainer.innerHTML = ''; // Clear existing content

  console.log('Rendering continuous mode with', pdfDoc.numPages, 'pages');

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    console.log(`Rendering page ${pageNum}, viewport: ${viewport.width}x${viewport.height}`);

    // Create wrapper for each page
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-wrapper';
    pageWrapper.dataset.page = pageNum;

    // Add page number label
    const pageLabel = document.createElement('div');
    pageLabel.className = 'page-number-label';
    pageLabel.textContent = `Page ${pageNum}`;
    pageWrapper.appendChild(pageLabel);

    // Create container for canvas layers
    const canvasContainer = document.createElement('div');
    canvasContainer.style.position = 'relative';
    canvasContainer.style.display = 'inline-block';

    // Create PDF canvas
    const pdfCanvas = document.createElement('canvas');
    pdfCanvas.className = 'pdf-canvas';
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    pdfCanvas.dataset.page = pageNum;
    pdfCanvas.style.display = 'block';
    pdfCanvas.style.background = 'white';
    pdfCanvas.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';

    // Create annotation canvas
    const annotationCanvas = document.createElement('canvas');
    annotationCanvas.className = 'annotation-canvas';
    annotationCanvas.width = viewport.width;
    annotationCanvas.height = viewport.height;
    annotationCanvas.dataset.page = pageNum;
    annotationCanvas.style.position = 'absolute';
    annotationCanvas.style.top = '0';
    annotationCanvas.style.left = '0';
    annotationCanvas.style.cursor = 'crosshair';

    // Append canvases to container
    canvasContainer.appendChild(pdfCanvas);
    canvasContainer.appendChild(annotationCanvas);
    pageWrapper.appendChild(canvasContainer);
    continuousContainer.appendChild(pageWrapper);

    // Render PDF page AFTER adding to DOM
    const pdfCtx = pdfCanvas.getContext('2d');
    try {
      await page.render({
        canvasContext: pdfCtx,
        viewport: viewport
      }).promise;
      console.log(`Page ${pageNum} rendered successfully`);
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
    }

    // Render annotations for this page
    const annotationCtx = annotationCanvas.getContext('2d');
    renderAnnotationsForPage(annotationCtx, pageNum, viewport.width, viewport.height);

    // Add event listeners for annotations (using closure to capture pageNum)
    (function(pageNumber) {
      annotationCanvas.addEventListener('mousedown', function(e) {
        handleContinuousMouseDown(e, pageNumber);
      });
      annotationCanvas.addEventListener('mousemove', function(e) {
        handleContinuousMouseMove(e, pageNumber);
      });
      annotationCanvas.addEventListener('mouseup', function(e) {
        handleContinuousMouseUp(e, pageNumber);
      });
    })(pageNum);
  }

  // Update page info
  pageInfo.textContent = `Continuous View - ${pdfDoc.numPages} pages`;
  prevPageBtn.disabled = true;
  nextPageBtn.disabled = true;

  console.log('Continuous mode rendering complete');
}

// Render annotations for a specific page
function renderAnnotationsForPage(ctx, pageNum, width, height) {
  ctx.clearRect(0, 0, width, height);

  annotations.forEach(annotation => {
    if (annotation.page !== pageNum) return;

    ctx.strokeStyle = annotation.color;
    ctx.fillStyle = annotation.color;
    ctx.lineWidth = annotation.lineWidth || 3;
    ctx.globalAlpha = annotation.type === 'highlight' ? 0.3 : 1;

    switch (annotation.type) {
      case 'draw':
        ctx.beginPath();
        annotation.path.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
        break;

      case 'highlight':
        ctx.fillRect(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height
        );
        break;

      case 'line':
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(annotation.startX, annotation.startY);
        ctx.lineTo(annotation.endX, annotation.endY);
        ctx.stroke();
        break;

      case 'circle':
        ctx.beginPath();
        ctx.arc(annotation.centerX, annotation.centerY, annotation.radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case 'box':
        ctx.strokeRect(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height
        );
        break;

      case 'comment':
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(annotation.x, annotation.y, 24, 24);
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.strokeRect(annotation.x, annotation.y, 24, 24);

        if (annotation.text) {
          ctx.fillStyle = '#000';
          ctx.font = '12px Arial';
          ctx.fillText(
            annotation.text.substring(0, 20) + '...',
            annotation.x + 30,
            annotation.y + 16
          );
        }
        break;

      case 'text':
        ctx.globalAlpha = 1;
        ctx.fillStyle = annotation.color;
        ctx.font = `${annotation.fontSize || 16}px Arial`;
        ctx.fillText(annotation.text, annotation.x, annotation.y);
        break;
    }
  });

  ctx.globalAlpha = 1;
}

// Redraw all pages in continuous mode
function redrawContinuous() {
  const pageWrappers = document.querySelectorAll('.page-wrapper');
  pageWrappers.forEach(wrapper => {
    const pageNum = parseInt(wrapper.dataset.page);
    const annotationCanvas = wrapper.querySelector('.annotation-canvas');
    const ctx = annotationCanvas.getContext('2d');
    renderAnnotationsForPage(ctx, pageNum, annotationCanvas.width, annotationCanvas.height);
  });
}

// Switch view mode
async function setViewMode(mode) {
  if (!pdfDoc) return;

  viewMode = mode;
  const singleContainer = document.getElementById('canvas-container');
  const continuousContainer = document.getElementById('continuous-container');

  if (mode === 'single') {
    singleContainer.style.display = 'inline-block';
    continuousContainer.style.display = 'none';
    await renderPage(currentPage);

    // Update button states
    document.getElementById('single-page')?.classList.add('active');
    document.getElementById('continuous')?.classList.remove('active');
  } else if (mode === 'continuous') {
    singleContainer.style.display = 'none';
    continuousContainer.style.display = 'flex';
    await renderContinuous();

    // Update button states
    document.getElementById('single-page')?.classList.remove('active');
    document.getElementById('continuous')?.classList.add('active');
  }
}

// Mouse event handlers for continuous mode
let activeContinuousCanvas = null;
let activeContinuousPage = null;

function handleContinuousMouseDown(e, pageNum) {
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

  activeContinuousCanvas = canvas;
  activeContinuousPage = pageNum;
  currentPage = pageNum; // Update current page for annotation storage

  if (currentTool === 'select') {
    const clickedAnnotation = findAnnotationAt(startX, startY);
    if (clickedAnnotation) {
      showProperties(clickedAnnotation);
    } else {
      hideProperties();
    }
    return;
  }

  isDrawing = true;

  if (currentTool === 'draw') {
    currentPath = [{ x: startX, y: startY }];
  } else if (currentTool === 'comment') {
    addComment(startX, startY);
    isDrawing = false;
  } else if (currentTool === 'text') {
    addText(startX, startY);
    isDrawing = false;
  }
}

function handleContinuousMouseMove(e, pageNum) {
  // Only handle mousemove if we're actively drawing
  if (!isDrawing) return;
  if (activeContinuousPage !== pageNum) return;
  if (!activeContinuousCanvas) return;

  const canvas = activeContinuousCanvas;
  const rect = canvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  const ctx = canvas.getContext('2d');

  if (currentTool === 'draw') {
    currentPath.push({ x: currentX, y: currentY });
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = parseInt(lineWidth.value);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(currentPath[currentPath.length - 2].x, currentPath[currentPath.length - 2].y);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
  } else if (currentTool === 'highlight' || currentTool === 'line' || currentTool === 'circle' || currentTool === 'box') {
    // Redraw page to show preview
    renderAnnotationsForPage(ctx, pageNum, canvas.width, canvas.height);

    if (currentTool === 'highlight') {
      ctx.fillStyle = colorPicker.value;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
      ctx.globalAlpha = 1;
    } else if (currentTool === 'line') {
      ctx.strokeStyle = colorPicker.value;
      ctx.lineWidth = parseInt(lineWidth.value);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
    } else if (currentTool === 'circle') {
      const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
      ctx.strokeStyle = colorPicker.value;
      ctx.lineWidth = parseInt(lineWidth.value);
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (currentTool === 'box') {
      ctx.strokeStyle = colorPicker.value;
      ctx.lineWidth = parseInt(lineWidth.value);
      ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    }
  }
}

function handleContinuousMouseUp(e, pageNum) {
  if (!isDrawing || activeContinuousPage !== pageNum) return;

  const rect = activeContinuousCanvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  if (currentTool === 'draw' && currentPath.length > 1) {
    annotations.push({
      type: 'draw',
      page: pageNum,
      path: currentPath,
      color: colorPicker.value,
      lineWidth: parseInt(lineWidth.value)
    });
    currentPath = [];
  } else if (currentTool === 'highlight') {
    annotations.push({
      type: 'highlight',
      page: pageNum,
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      color: colorPicker.value
    });
  } else if (currentTool === 'line') {
    annotations.push({
      type: 'line',
      page: pageNum,
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      color: colorPicker.value,
      lineWidth: parseInt(lineWidth.value)
    });
  } else if (currentTool === 'circle') {
    const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    annotations.push({
      type: 'circle',
      page: pageNum,
      centerX: startX,
      centerY: startY,
      radius: radius,
      color: colorPicker.value,
      lineWidth: parseInt(lineWidth.value)
    });
  } else if (currentTool === 'box') {
    annotations.push({
      type: 'box',
      page: pageNum,
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY,
      color: colorPicker.value,
      lineWidth: parseInt(lineWidth.value)
    });
  }

  isDrawing = false;
  activeContinuousCanvas = null;
  activeContinuousPage = null;

  // Redraw to show final annotation
  redrawContinuous();
}

// Redraw all annotations
function redrawAnnotations() {
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

  annotations.forEach(annotation => {
    if (annotation.page !== currentPage) return;

    annotationCtx.strokeStyle = annotation.color;
    annotationCtx.fillStyle = annotation.color;
    annotationCtx.lineWidth = annotation.lineWidth || 3;
    annotationCtx.globalAlpha = annotation.type === 'highlight' ? 0.3 : 1;

    switch (annotation.type) {
      case 'draw':
        annotationCtx.beginPath();
        annotation.path.forEach((point, index) => {
          if (index === 0) {
            annotationCtx.moveTo(point.x, point.y);
          } else {
            annotationCtx.lineTo(point.x, point.y);
          }
        });
        annotationCtx.stroke();
        break;

      case 'highlight':
        annotationCtx.fillRect(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height
        );
        break;

      case 'line':
        annotationCtx.lineCap = 'round';
        annotationCtx.beginPath();
        annotationCtx.moveTo(annotation.startX, annotation.startY);
        annotationCtx.lineTo(annotation.endX, annotation.endY);
        annotationCtx.stroke();
        break;

      case 'circle':
        annotationCtx.beginPath();
        annotationCtx.arc(annotation.centerX, annotation.centerY, annotation.radius, 0, 2 * Math.PI);
        annotationCtx.stroke();
        break;

      case 'box':
        annotationCtx.strokeRect(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height
        );
        break;

      case 'comment':
        // Draw comment icon
        annotationCtx.globalAlpha = 1;
        annotationCtx.fillStyle = '#FFD700';
        annotationCtx.fillRect(annotation.x, annotation.y, 24, 24);
        annotationCtx.strokeStyle = '#FFA500';
        annotationCtx.lineWidth = 2;
        annotationCtx.strokeRect(annotation.x, annotation.y, 24, 24);

        // Draw text if hovering (simplified - just show first line)
        if (annotation.text) {
          annotationCtx.fillStyle = '#000';
          annotationCtx.font = '12px Arial';
          annotationCtx.fillText(
            annotation.text.substring(0, 20) + '...',
            annotation.x + 30,
            annotation.y + 16
          );
        }
        break;

      case 'text':
        annotationCtx.globalAlpha = 1;
        annotationCtx.fillStyle = annotation.color;
        annotationCtx.font = `${annotation.fontSize || 16}px Arial`;
        annotationCtx.fillText(annotation.text, annotation.x, annotation.y);
        break;
    }
  });

  annotationCtx.globalAlpha = 1;

  // Draw selection highlight
  if (selectedAnnotation) {
    const sel = selectedAnnotation;
    annotationCtx.strokeStyle = '#667eea';
    annotationCtx.lineWidth = 2;
    annotationCtx.setLineDash([5, 5]);

    switch (sel.type) {
      case 'draw':
        if (sel.path && sel.path.length > 0) {
          const minX = Math.min(...sel.path.map(p => p.x)) - 5;
          const minY = Math.min(...sel.path.map(p => p.y)) - 5;
          const maxX = Math.max(...sel.path.map(p => p.x)) + 5;
          const maxY = Math.max(...sel.path.map(p => p.y)) + 5;
          annotationCtx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        }
        break;
      case 'line':
        const padding = 5;
        const minX = Math.min(sel.startX, sel.endX) - padding;
        const minY = Math.min(sel.startY, sel.endY) - padding;
        const width = Math.abs(sel.endX - sel.startX) + 2 * padding;
        const height = Math.abs(sel.endY - sel.startY) + 2 * padding;
        annotationCtx.strokeRect(minX, minY, width, height);
        break;
      case 'circle':
        annotationCtx.beginPath();
        annotationCtx.arc(sel.centerX, sel.centerY, sel.radius + 5, 0, 2 * Math.PI);
        annotationCtx.stroke();
        break;
      case 'box':
        annotationCtx.strokeRect(sel.x - 5, sel.y - 5, sel.width + 10, sel.height + 10);
        break;
      case 'highlight':
        annotationCtx.strokeRect(sel.x - 5, sel.y - 5, sel.width + 10, sel.height + 10);
        break;
      case 'comment':
        annotationCtx.strokeRect(sel.x - 5, sel.y - 5, 34, 34);
        break;
      case 'text':
        const textWidth = annotationCtx.measureText(sel.text).width;
        const fontSize = sel.fontSize || 16;
        annotationCtx.strokeRect(sel.x - 5, sel.y - fontSize - 5, textWidth + 10, fontSize + 10);
        break;
    }

    annotationCtx.setLineDash([]);
  }
}

// Find annotation at coordinates
function findAnnotationAt(x, y) {
  // Search in reverse order (top annotations first)
  for (let i = annotations.length - 1; i >= 0; i--) {
    const ann = annotations[i];
    if (ann.page !== currentPage) continue;

    switch (ann.type) {
      case 'draw':
        // Check if point is near the path
        for (let point of ann.path) {
          const dist = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
          if (dist < 10) return ann;
        }
        break;
      case 'line':
        // Check if point is near the line
        const dist = distanceToLine(x, y, ann.startX, ann.startY, ann.endX, ann.endY);
        if (dist < 10) return ann;
        break;
      case 'circle':
        const distToCenter = Math.sqrt(Math.pow(x - ann.centerX, 2) + Math.pow(y - ann.centerY, 2));
        if (Math.abs(distToCenter - ann.radius) < 10) return ann;
        break;
      case 'box':
        if (isPointNearRect(x, y, ann.x, ann.y, ann.width, ann.height)) return ann;
        break;
      case 'highlight':
        if (x >= ann.x && x <= ann.x + ann.width && y >= ann.y && y <= ann.y + ann.height) return ann;
        break;
      case 'comment':
        if (x >= ann.x && x <= ann.x + 24 && y >= ann.y && y <= ann.y + 24) return ann;
        break;
      case 'text':
        const textWidth = annotationCtx.measureText(ann.text).width;
        const fontSize = ann.fontSize || 16;
        if (x >= ann.x && x <= ann.x + textWidth && y >= ann.y - fontSize && y <= ann.y) return ann;
        break;
    }
  }
  return null;
}

// Helper: distance from point to line segment
function distanceToLine(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Helper: check if point is near rectangle outline
function isPointNearRect(px, py, x, y, w, h, threshold = 10) {
  const insideOuter = px >= x - threshold && px <= x + w + threshold && py >= y - threshold && py <= y + h + threshold;
  const insideInner = px >= x + threshold && px <= x + w - threshold && py >= y + threshold && py <= y + h - threshold;
  return insideOuter && !insideInner;
}

// Show properties panel
function showProperties(annotation) {
  selectedAnnotation = annotation;

  propType.value = annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1);
  propColor.value = annotation.color || '#000000';
  propLineWidth.value = annotation.lineWidth || 3;

  // Show/hide relevant fields
  if (annotation.type === 'text' || annotation.type === 'comment') {
    propTextGroup.style.display = 'block';
    propText.value = annotation.text || '';
  } else {
    propTextGroup.style.display = 'none';
  }

  if (annotation.type === 'text') {
    propFontSizeGroup.style.display = 'block';
    propFontSize.value = annotation.fontSize || 16;
  } else {
    propFontSizeGroup.style.display = 'none';
  }

  if (['highlight', 'comment'].includes(annotation.type)) {
    propLineWidthGroup.style.display = 'none';
  } else {
    propLineWidthGroup.style.display = 'block';
  }

  propertiesPanel.classList.add('visible');
  redrawAnnotations();
}

// Hide properties panel
function hideProperties() {
  selectedAnnotation = null;
  propertiesPanel.classList.remove('visible');
  redrawAnnotations();
}

// Update annotation properties
function updateAnnotationProperties() {
  if (!selectedAnnotation) return;

  selectedAnnotation.color = propColor.value;
  selectedAnnotation.lineWidth = parseInt(propLineWidth.value);

  if (selectedAnnotation.type === 'text' || selectedAnnotation.type === 'comment') {
    selectedAnnotation.text = propText.value;
  }

  if (selectedAnnotation.type === 'text') {
    selectedAnnotation.fontSize = parseInt(propFontSize.value);
  }

  // Redraw based on view mode
  if (viewMode === 'continuous') {
    redrawContinuous();
  } else {
    redrawAnnotations();
  }
}

// Tool selection
function setTool(tool) {
  currentTool = tool;

  // Hide properties panel when switching tools
  if (tool !== 'select') {
    hideProperties();
  }

  // Update UI
  [toolSelect, toolHighlight, toolDraw, toolLine, toolCircle, toolBox, toolComment, toolText].forEach(btn => {
    btn.classList.remove('active');
  });

  switch (tool) {
    case 'select':
      toolSelect.classList.add('active');
      annotationCanvas.style.cursor = 'default';
      break;
    case 'highlight':
      toolHighlight.classList.add('active');
      annotationCanvas.style.cursor = 'crosshair';
      break;
    case 'draw':
      toolDraw.classList.add('active');
      annotationCanvas.style.cursor = 'crosshair';
      break;
    case 'line':
      toolLine.classList.add('active');
      annotationCanvas.style.cursor = 'crosshair';
      break;
    case 'circle':
      toolCircle.classList.add('active');
      annotationCanvas.style.cursor = 'crosshair';
      break;
    case 'box':
      toolBox.classList.add('active');
      annotationCanvas.style.cursor = 'crosshair';
      break;
    case 'comment':
      toolComment.classList.add('active');
      annotationCanvas.style.cursor = 'pointer';
      break;
    case 'text':
      toolText.classList.add('active');
      annotationCanvas.style.cursor = 'text';
      break;
  }
}

// Mouse event handlers
annotationCanvas.addEventListener('mousedown', (e) => {
  const rect = annotationCanvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

  if (currentTool === 'select') {
    // Check if clicking on an annotation
    const clickedAnnotation = findAnnotationAt(startX, startY);
    if (clickedAnnotation) {
      showProperties(clickedAnnotation);
    } else {
      hideProperties();
    }
    return;
  }

  isDrawing = true;

  if (currentTool === 'draw') {
    currentPath = [{ x: startX, y: startY }];
  } else if (currentTool === 'comment') {
    addComment(startX, startY);
    isDrawing = false;
  } else if (currentTool === 'text') {
    addText(startX, startY);
    isDrawing = false;
  }
});

annotationCanvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;

  const rect = annotationCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  if (currentTool === 'draw') {
    currentPath.push({ x: currentX, y: currentY });

    // Draw temporary line
    annotationCtx.strokeStyle = colorPicker.value;
    annotationCtx.lineWidth = parseInt(lineWidth.value);
    annotationCtx.lineCap = 'round';
    annotationCtx.lineJoin = 'round';
    annotationCtx.beginPath();
    annotationCtx.moveTo(currentPath[currentPath.length - 2].x, currentPath[currentPath.length - 2].y);
    annotationCtx.lineTo(currentX, currentY);
    annotationCtx.stroke();
  } else if (currentTool === 'highlight') {
    // Show preview rectangle
    redrawAnnotations();
    annotationCtx.fillStyle = colorPicker.value;
    annotationCtx.globalAlpha = 0.3;
    annotationCtx.fillRect(
      startX,
      startY,
      currentX - startX,
      currentY - startY
    );
    annotationCtx.globalAlpha = 1;
  } else if (currentTool === 'line') {
    // Show preview line
    redrawAnnotations();
    annotationCtx.strokeStyle = colorPicker.value;
    annotationCtx.lineWidth = parseInt(lineWidth.value);
    annotationCtx.lineCap = 'round';
    annotationCtx.beginPath();
    annotationCtx.moveTo(startX, startY);
    annotationCtx.lineTo(currentX, currentY);
    annotationCtx.stroke();
  } else if (currentTool === 'circle') {
    // Show preview circle
    redrawAnnotations();
    const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
    annotationCtx.strokeStyle = colorPicker.value;
    annotationCtx.lineWidth = parseInt(lineWidth.value);
    annotationCtx.beginPath();
    annotationCtx.arc(startX, startY, radius, 0, 2 * Math.PI);
    annotationCtx.stroke();
  } else if (currentTool === 'box') {
    // Show preview rectangle
    redrawAnnotations();
    annotationCtx.strokeStyle = colorPicker.value;
    annotationCtx.lineWidth = parseInt(lineWidth.value);
    annotationCtx.strokeRect(
      startX,
      startY,
      currentX - startX,
      currentY - startY
    );
  }
});

annotationCanvas.addEventListener('mouseup', (e) => {
  if (!isDrawing) return;

  const rect = annotationCanvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  if (currentTool === 'draw' && currentPath.length > 1) {
    annotations.push({
      type: 'draw',
      page: currentPage,
      path: currentPath,
      color: colorPicker.value,
      lineWidth: parseInt(lineWidth.value)
    });
    currentPath = [];
  } else if (currentTool === 'highlight') {
    annotations.push({
      type: 'highlight',
      page: currentPage,
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      color: colorPicker.value
    });
  } else if (currentTool === 'line') {
    annotations.push({
      type: 'line',
      page: currentPage,
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      color: colorPicker.value,
      lineWidth: parseInt(lineWidth.value)
    });
  } else if (currentTool === 'circle') {
    const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    annotations.push({
      type: 'circle',
      page: currentPage,
      centerX: startX,
      centerY: startY,
      radius: radius,
      color: colorPicker.value,
      lineWidth: parseInt(lineWidth.value)
    });
  } else if (currentTool === 'box') {
    annotations.push({
      type: 'box',
      page: currentPage,
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY,
      color: colorPicker.value,
      lineWidth: parseInt(lineWidth.value)
    });
  }

  isDrawing = false;
  redrawAnnotations();
});

// Add comment
function addComment(x, y) {
  const commentText = prompt('Enter your comment:');
  if (commentText) {
    annotations.push({
      type: 'comment',
      page: currentPage,
      x: x,
      y: y,
      text: commentText,
      color: colorPicker.value
    });
    if (viewMode === 'continuous') {
      redrawContinuous();
    } else {
      redrawAnnotations();
    }
  }
}

// Add text
function addText(x, y) {
  const text = prompt('Enter text:');
  if (text) {
    annotations.push({
      type: 'text',
      page: currentPage,
      x: x,
      y: y,
      text: text,
      color: colorPicker.value,
      fontSize: parseInt(lineWidth.value) * 4
    });
    if (viewMode === 'continuous') {
      redrawContinuous();
    } else {
      redrawAnnotations();
    }
  }
}

// Open PDF file function
async function openPDFFile() {
  try {
    console.log('Opening file dialog');
    const filePath = await window.electronAPI.openFile();
    console.log('File selected:', filePath);
    if (filePath) {
      // Reset state
      annotations = [];
      currentPage = 1;
      await loadPDF(filePath);
    }
  } catch (error) {
    console.error('Error opening file:', error);
    alert('Failed to open PDF file: ' + error.message);
  }
}

// Event listeners
toolSelect.addEventListener('click', () => setTool('select'));
toolHighlight.addEventListener('click', () => setTool('highlight'));
toolDraw.addEventListener('click', () => setTool('draw'));
toolLine.addEventListener('click', () => setTool('line'));
toolCircle.addEventListener('click', () => setTool('circle'));
toolBox.addEventListener('click', () => setTool('box'));
toolComment.addEventListener('click', () => setTool('comment'));
toolText.addEventListener('click', () => setTool('text'));

toolClear.addEventListener('click', () => {
  if (confirm('Clear all annotations on this page?')) {
    annotations = annotations.filter(a => a.page !== currentPage);
    if (viewMode === 'continuous') {
      redrawContinuous();
    } else {
      redrawAnnotations();
    }
  }
});

toolUndo.addEventListener('click', () => {
  const pageAnnotations = annotations.filter(a => a.page === currentPage);
  if (pageAnnotations.length > 0) {
    annotations = annotations.filter(a => a !== pageAnnotations[pageAnnotations.length - 1]);
    if (viewMode === 'continuous') {
      redrawContinuous();
    } else {
      redrawAnnotations();
    }
  }
});

// Properties panel event listeners
propColor.addEventListener('input', updateAnnotationProperties);
propLineWidth.addEventListener('input', updateAnnotationProperties);
propText.addEventListener('input', updateAnnotationProperties);
propFontSize.addEventListener('input', updateAnnotationProperties);

propDelete.addEventListener('click', () => {
  if (selectedAnnotation && confirm('Delete this annotation?')) {
    annotations = annotations.filter(a => a !== selectedAnnotation);
    hideProperties();
    if (viewMode === 'continuous') {
      redrawContinuous();
    } else {
      redrawAnnotations();
    }
  }
});

propClose.addEventListener('click', hideProperties);

prevPageBtn.addEventListener('click', async () => {
  if (currentPage > 1) {
    currentPage--;
    hideProperties();
    await renderPage(currentPage);
  }
});

nextPageBtn.addEventListener('click', async () => {
  if (currentPage < pdfDoc.numPages) {
    currentPage++;
    hideProperties();
    await renderPage(currentPage);
  }
});

zoomInBtn.addEventListener('click', async () => {
  scale += 0.25;
  zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  if (viewMode === 'continuous') {
    await renderContinuous();
  } else {
    await renderPage(currentPage);
  }
});

zoomOutBtn.addEventListener('click', async () => {
  if (scale > 0.5) {
    scale -= 0.25;
    zoomLevel.textContent = `${Math.round(scale * 100)}%`;
    if (viewMode === 'continuous') {
      await renderContinuous();
    } else {
      await renderPage(currentPage);
    }
  }
});

// Ribbon tab switching
ribbonTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // Update active tab
    ribbonTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active content
    ribbonContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `tab-${tabName}`) {
        content.classList.add('active');
      }
    });
  });
});

// Connect ribbon buttons to existing functionality
// Home tab buttons
document.getElementById('zoom-in-ribbon')?.addEventListener('click', () => {
  zoomInBtn.click();
});

document.getElementById('zoom-out-ribbon')?.addEventListener('click', () => {
  zoomOutBtn.click();
});

document.getElementById('prev-page-ribbon')?.addEventListener('click', () => {
  prevPageBtn.click();
});

document.getElementById('next-page-ribbon')?.addEventListener('click', () => {
  nextPageBtn.click();
});

document.getElementById('first-page')?.addEventListener('click', async () => {
  if (pdfDoc && currentPage !== 1) {
    currentPage = 1;
    hideProperties();
    await renderPage(currentPage);
  }
});

document.getElementById('last-page')?.addEventListener('click', async () => {
  if (pdfDoc && currentPage !== pdfDoc.numPages) {
    currentPage = pdfDoc.numPages;
    hideProperties();
    await renderPage(currentPage);
  }
});

document.getElementById('fit-width')?.addEventListener('click', async () => {
  if (pdfDoc) {
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const container = document.querySelector('.main-view');
    const containerWidth = container.clientWidth - 40; // padding
    scale = containerWidth / viewport.width;
    zoomLevel.textContent = `${Math.round(scale * 100)}%`;
    if (viewMode === 'continuous') {
      await renderContinuous();
    } else {
      await renderPage(currentPage);
    }
  }
});

// View tab buttons
document.getElementById('actual-size')?.addEventListener('click', async () => {
  scale = 1;
  zoomLevel.textContent = '100%';
  if (pdfDoc) {
    if (viewMode === 'continuous') {
      await renderContinuous();
    } else {
      await renderPage(currentPage);
    }
  }
});

document.getElementById('fit-page')?.addEventListener('click', async () => {
  if (pdfDoc) {
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const container = document.querySelector('.main-view');
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;
    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    scale = Math.min(scaleX, scaleY);
    zoomLevel.textContent = `${Math.round(scale * 100)}%`;

    if (viewMode === 'continuous') {
      await renderContinuous();
    } else {
      await renderPage(currentPage);
    }
  }
});

// View mode buttons
document.getElementById('single-page')?.addEventListener('click', () => {
  setViewMode('single');
});

document.getElementById('continuous')?.addEventListener('click', () => {
  setViewMode('continuous');
});

// Menu System
const menuItems = document.querySelectorAll('.menu-item');
const menuDropdowns = document.querySelectorAll('.menu-dropdown');
let activeMenu = null;

// Toggle menu visibility
function toggleMenu(menuName) {
  const menuItem = document.querySelector(`[data-menu="${menuName}"]`);
  const dropdown = document.getElementById(`menu-${menuName}`);

  if (activeMenu === menuName) {
    closeAllMenus();
    return;
  }

  closeAllMenus();
  activeMenu = menuName;
  menuItem.classList.add('active');
  dropdown.classList.add('visible');
}

// Close all menus
function closeAllMenus() {
  menuItems.forEach(item => item.classList.remove('active'));
  menuDropdowns.forEach(dropdown => dropdown.classList.remove('visible'));
  activeMenu = null;
}

// Menu item click handlers
menuItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const menuName = item.dataset.menu;
    toggleMenu(menuName);
  });
});

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-item') && !e.target.closest('.menu-dropdown')) {
    closeAllMenus();
  }
});

// FILE MENU ACTIONS
document.getElementById('menu-open')?.addEventListener('click', () => {
  closeAllMenus();
  openPDFFile();
});

document.getElementById('menu-save')?.addEventListener('click', () => {
  closeAllMenus();
  alert('Save functionality to be implemented');
});

document.getElementById('menu-save-as')?.addEventListener('click', () => {
  closeAllMenus();
  alert('Save As functionality to be implemented');
});

document.getElementById('menu-close')?.addEventListener('click', () => {
  closeAllMenus();
  if (pdfDoc && confirm('Close current PDF?')) {
    pdfDoc = null;
    annotations = [];
    currentPage = 1;
    pdfContainer.classList.remove('visible');
    pageControls.classList.remove('visible');
    placeholder.style.display = 'block';
    fileInfo.textContent = '';
  }
});

document.getElementById('menu-exit')?.addEventListener('click', () => {
  closeAllMenus();
  if (confirm('Exit PDF Annotator?')) {
    window.close();
  }
});

// EDIT MENU ACTIONS
document.getElementById('menu-undo')?.addEventListener('click', () => {
  closeAllMenus();
  toolUndo.click();
});

document.getElementById('menu-redo')?.addEventListener('click', () => {
  closeAllMenus();
  alert('Redo functionality to be implemented');
});

document.getElementById('menu-delete')?.addEventListener('click', () => {
  closeAllMenus();
  if (selectedAnnotation) {
    propDelete.click();
  }
});

document.getElementById('menu-clear-page')?.addEventListener('click', () => {
  closeAllMenus();
  toolClear.click();
});

document.getElementById('menu-clear-all')?.addEventListener('click', () => {
  closeAllMenus();
  if (confirm('Clear all annotations from all pages?')) {
    annotations = [];
    if (viewMode === 'continuous') {
      redrawContinuous();
    } else {
      redrawAnnotations();
    }
  }
});

document.getElementById('menu-select-all')?.addEventListener('click', () => {
  closeAllMenus();
  alert('Select All functionality to be implemented');
});

// VIEW MENU ACTIONS
document.getElementById('menu-zoom-in')?.addEventListener('click', () => {
  closeAllMenus();
  zoomInBtn.click();
});

document.getElementById('menu-zoom-out')?.addEventListener('click', () => {
  closeAllMenus();
  zoomOutBtn.click();
});

document.getElementById('menu-actual-size')?.addEventListener('click', () => {
  closeAllMenus();
  document.getElementById('actual-size')?.click();
});

document.getElementById('menu-fit-width')?.addEventListener('click', () => {
  closeAllMenus();
  document.getElementById('fit-width')?.click();
});

document.getElementById('menu-fit-page')?.addEventListener('click', () => {
  closeAllMenus();
  document.getElementById('fit-page')?.click();
});

document.getElementById('menu-rotate-left')?.addEventListener('click', () => {
  closeAllMenus();
  alert('Rotate Left functionality to be implemented');
});

document.getElementById('menu-rotate-right')?.addEventListener('click', () => {
  closeAllMenus();
  alert('Rotate Right functionality to be implemented');
});

document.getElementById('menu-single-page')?.addEventListener('click', () => {
  closeAllMenus();
  setViewMode('single');
});

document.getElementById('menu-continuous')?.addEventListener('click', () => {
  closeAllMenus();
  setViewMode('continuous');
});

document.getElementById('menu-show-properties')?.addEventListener('click', () => {
  closeAllMenus();
  if (propertiesPanel.classList.contains('visible')) {
    hideProperties();
  } else if (selectedAnnotation) {
    showProperties(selectedAnnotation);
  }
});

// TOOLS MENU ACTIONS
document.getElementById('menu-tool-select')?.addEventListener('click', () => {
  closeAllMenus();
  setTool('select');
});

document.getElementById('menu-tool-hand')?.addEventListener('click', () => {
  closeAllMenus();
  alert('Hand Tool functionality to be implemented');
});

document.getElementById('menu-tool-highlight')?.addEventListener('click', () => {
  closeAllMenus();
  setTool('highlight');
});

document.getElementById('menu-tool-draw')?.addEventListener('click', () => {
  closeAllMenus();
  setTool('draw');
});

document.getElementById('menu-tool-line')?.addEventListener('click', () => {
  closeAllMenus();
  setTool('line');
});

document.getElementById('menu-tool-box')?.addEventListener('click', () => {
  closeAllMenus();
  setTool('box');
});

document.getElementById('menu-tool-circle')?.addEventListener('click', () => {
  closeAllMenus();
  setTool('circle');
});

document.getElementById('menu-tool-text')?.addEventListener('click', () => {
  closeAllMenus();
  setTool('text');
});

document.getElementById('menu-tool-comment')?.addEventListener('click', () => {
  closeAllMenus();
  setTool('comment');
});

// HELP MENU ACTIONS
document.getElementById('menu-about')?.addEventListener('click', () => {
  closeAllMenus();
  alert('PDF Annotator v1.0.0\n\nA professional PDF annotation application built with Electron and PDF.js.\n\n© 2026 PDF Annotator');
});

document.getElementById('menu-shortcuts')?.addEventListener('click', () => {
  closeAllMenus();
  const shortcuts = `Keyboard Shortcuts:

FILE:
Ctrl+O - Open PDF
Ctrl+S - Save
Ctrl+W - Close

EDIT:
Ctrl+Z - Undo
Delete - Delete selected annotation
Ctrl+Shift+C - Clear page annotations

VIEW:
Ctrl++ - Zoom In
Ctrl+- - Zoom Out
Ctrl+0 - Actual Size
Ctrl+1 - Fit Width
Ctrl+2 - Fit Page

TOOLS:
V - Select Tool
H - Hand Tool
1 - Highlight
2 - Freehand
3 - Line
4 - Rectangle
5 - Ellipse
T - Text Box
N - Note`;
  alert(shortcuts);
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  // Check if typing in an input field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;

  // File shortcuts
  if (ctrl && e.key === 'o') {
    e.preventDefault();
    openPDFFile();
  } else if (ctrl && e.key === 's') {
    e.preventDefault();
    alert('Save functionality to be implemented');
  } else if (ctrl && e.key === 'w') {
    e.preventDefault();
    document.getElementById('menu-close')?.click();
  }

  // Edit shortcuts
  else if (ctrl && !shift && e.key === 'z') {
    e.preventDefault();
    toolUndo.click();
  } else if (e.key === 'Delete') {
    e.preventDefault();
    if (selectedAnnotation) {
      propDelete.click();
    }
  } else if (ctrl && shift && e.key === 'C') {
    e.preventDefault();
    toolClear.click();
  }

  // View shortcuts
  else if (ctrl && e.key === '=') {
    e.preventDefault();
    zoomInBtn.click();
  } else if (ctrl && e.key === '-') {
    e.preventDefault();
    zoomOutBtn.click();
  } else if (ctrl && e.key === '0') {
    e.preventDefault();
    document.getElementById('actual-size')?.click();
  } else if (ctrl && e.key === '1') {
    e.preventDefault();
    document.getElementById('fit-width')?.click();
  } else if (ctrl && e.key === '2') {
    e.preventDefault();
    document.getElementById('fit-page')?.click();
  }

  // Tool shortcuts (only if PDF is loaded)
  else if (pdfDoc) {
    if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      setTool('select');
    } else if (e.key === '1') {
      e.preventDefault();
      setTool('highlight');
    } else if (e.key === '2') {
      e.preventDefault();
      setTool('draw');
    } else if (e.key === '3') {
      e.preventDefault();
      setTool('line');
    } else if (e.key === '4') {
      e.preventDefault();
      setTool('box');
    } else if (e.key === '5') {
      e.preventDefault();
      setTool('circle');
    } else if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      setTool('text');
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      setTool('comment');
    }
  }

  // Help shortcuts
  else if (e.key === 'F1') {
    e.preventDefault();
    document.getElementById('menu-shortcuts')?.click();
  } else if (e.key === 'F12') {
    e.preventDefault();
    document.getElementById('menu-show-properties')?.click();
  }
});

// Scroll navigation and zoom
document.querySelector('.main-view')?.addEventListener('wheel', async (e) => {
  if (!pdfDoc) return;

  // Check if Ctrl key is pressed for zoom functionality
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();

    const zoomStep = 0.1;
    const minZoom = 0.5;
    const maxZoom = 5.0;

    // Zoom in (scroll up) or zoom out (scroll down)
    if (e.deltaY < 0) {
      // Zoom in
      scale = Math.min(scale + zoomStep, maxZoom);
    } else {
      // Zoom out
      scale = Math.max(scale - zoomStep, minZoom);
    }

    // Update zoom level display
    zoomLevel.textContent = `${Math.round(scale * 100)}%`;

    // Re-render based on view mode
    if (viewMode === 'continuous') {
      await renderContinuous();
    } else {
      await renderPage(currentPage);
    }
    return;
  }

  // Page navigation in single page mode (without Ctrl)
  if (viewMode !== 'single') return;

  const mainView = e.currentTarget;
  const scrollTop = mainView.scrollTop;
  const scrollHeight = mainView.scrollHeight;
  const clientHeight = mainView.clientHeight;

  // Scrolling down at the bottom
  if (e.deltaY > 0 && scrollTop + clientHeight >= scrollHeight - 5) {
    if (currentPage < pdfDoc.numPages) {
      e.preventDefault();
      currentPage++;
      await renderPage(currentPage);
      // Scroll to top after page change
      mainView.scrollTop = 0;
    }
  }
  // Scrolling up at the top
  else if (e.deltaY < 0 && scrollTop <= 5) {
    if (currentPage > 1) {
      e.preventDefault();
      currentPage--;
      await renderPage(currentPage);
      // Scroll to bottom after page change
      mainView.scrollTop = mainView.scrollHeight;
    }
  }
});

// Initialize
console.log('Renderer script loaded');
setTool('select');
