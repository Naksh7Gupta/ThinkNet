// ThinkNet Dashboard - Core Workspace
// Features will wrap around this shell

document.addEventListener('DOMContentLoaded', () => {
  console.log('ThinkNet Dashboard initialized');

  // Navigation switching
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const section = item.dataset.section;
      console.log(`Switched to ${section} workspace`);
      // TODO: Load section-specific content
    });
  });

  // Node selection
  const nodes = document.querySelectorAll('.node');
  nodes.forEach(node => {
    node.addEventListener('click', (e) => {
      nodes.forEach(n => n.classList.remove('selected'));
      node.classList.add('selected');
      updateProperties(node);
    });
  });

  // Zoom controls
  let zoom = 100;
  const zoomDisplay = document.querySelector('.zoom-controls span');
  document.querySelector('.zoom-controls button:first-child').addEventListener('click', () => {
    zoom = Math.max(50, zoom - 10);
    zoomDisplay.textContent = `${zoom}%`;
    document.getElementById('nodeGraph').style.transform = `scale(${zoom/100})`;
  });
  document.querySelector('.zoom-controls button:last-child').addEventListener('click', () => {
    zoom = Math.min(200, zoom + 10);
    zoomDisplay.textContent = `${zoom}%`;
    document.getElementById('nodeGraph').style.transform = `scale(${zoom/100})`;
  });

  // Add Node button
  document.querySelector('.add-node-btn').addEventListener('click', () => {
    alert('Add Node dialog coming soon. This will open a component palette.');
  });

  // Sidebar buttons
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  function updateProperties(node) {
    const header = node.querySelector('.node-header').textContent;
    document.querySelector('.properties-panel .node-id').textContent = `Node selected`;
    document.querySelector('.prop-section input').value = header;
    console.log(`Properties updated for: ${header}`);
  }

  // Keyboard shortcut hint
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'A') {
      document.querySelector('.add-node-btn').click();
    }
  });
});
