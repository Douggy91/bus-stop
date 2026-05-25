/**
 * panelResizer.js
 * Enables drag-to-resize between the three main dashboard panels.
 * Adjusts CSS custom properties on .dashboard-grid to reflow the grid.
 */

const MIN_COL_PX = 220;   // Minimum width for any panel (px)
const MAX_LEFT_PX = 480;  // Maximum width for left sidebar
const MAX_RIGHT_PX = 600; // Maximum width for right arrival panel

// Clear stale saved sizes from previous layout
sessionStorage.removeItem('panel-left');
sessionStorage.removeItem('panel-right');


export function initPanelResizers() {
  const grid = document.querySelector('.dashboard-grid');
  const resizerLeft  = document.getElementById('resizer-left');
  const resizerRight = document.getElementById('resizer-right');

  if (!grid || !resizerLeft || !resizerRight) return;

  // Read initial column sizes from computed style
  function getGridCols() {
    const style = getComputedStyle(grid);
    const cols   = style.gridTemplateColumns.split(' ');
    // cols: [leftPx, 8px, centerPx, 8px, rightPx]
    return {
      left:   parseFloat(cols[0]),
      center: parseFloat(cols[2]),
      right:  parseFloat(cols[4]),
    };
  }

  function applyWidths(leftPx, rightPx) {
    grid.style.setProperty('--col-left',  `${leftPx}px`);
    grid.style.setProperty('--col-right', `${rightPx}px`);
    grid.style.setProperty('--col-center', '1fr');
  }

  function setupResizer(resizerEl, side) {
    let startX = 0;
    let startLeft = 0;
    let startRight = 0;

    function onMouseMove(e) {
      const dx = e.clientX - startX;
      let cols = { left: startLeft, right: startRight };

      if (side === 'left') {
        // Dragging left resizer → adjust left panel width
        let newLeft = Math.max(MIN_COL_PX, Math.min(MAX_LEFT_PX, startLeft + dx));
        applyWidths(newLeft, cols.right);
      } else {
        // Dragging right resizer → adjust right panel width (inverted dx)
        let newRight = Math.max(MIN_COL_PX, Math.min(MAX_RIGHT_PX, startRight - dx));
        applyWidths(cols.left, newRight);
      }
    }

    function onMouseUp() {
      resizerEl.classList.remove('dragging');
      document.body.style.cursor  = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Persist sizes in sessionStorage
      const gridStyle = getComputedStyle(grid);
      const cols = gridStyle.gridTemplateColumns.split(' ');
      sessionStorage.setItem('panel-left',  cols[0]);
      sessionStorage.setItem('panel-right', cols[4]);
    }

    resizerEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      const { left, right } = getGridCols();
      startLeft  = left;
      startRight = right;

      resizerEl.classList.add('dragging');
      document.body.style.cursor     = 'col-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Touch support
    resizerEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      startX = touch.clientX;
      const { left, right } = getGridCols();
      startLeft  = left;
      startRight = right;
      resizerEl.classList.add('dragging');
    }, { passive: false });

    resizerEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const cols = { left: startLeft, right: startRight };
      if (side === 'left') {
        let newLeft = Math.max(MIN_COL_PX, Math.min(MAX_LEFT_PX, startLeft + dx));
        applyWidths(newLeft, cols.right);
      } else {
        let newRight = Math.max(MIN_COL_PX, Math.min(MAX_RIGHT_PX, startRight - dx));
        applyWidths(cols.left, newRight);
      }
    }, { passive: false });

    resizerEl.addEventListener('touchend', () => {
      resizerEl.classList.remove('dragging');
    });
  }

  // Restore saved sizes from sessionStorage
  const savedLeft  = sessionStorage.getItem('panel-left');
  const savedRight = sessionStorage.getItem('panel-right');
  if (savedLeft && savedRight) {
    grid.style.setProperty('--col-left',  savedLeft);
    grid.style.setProperty('--col-right', savedRight);
  }

  setupResizer(resizerLeft,  'left');
  setupResizer(resizerRight, 'right');
}
