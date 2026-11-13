/* Insert-menu snippets (Xenapse 0.1.0 syntax). $0 marks the caret position. */
(function () {
  Xen.snippets = {
    groups: [
      { title: 'FLOW elements', items: [
        { id: 'start', label: 'Start', text: 'START' },
        { id: 'end', label: 'End', text: 'END' },
        { id: 'process', label: 'Process', text: '[ $0 ]' },
        { id: 'event', label: 'Event', text: '( $0 )' },
        { id: 'decision', label: 'Decision', text: '< $0 >' },
        { id: 'decision-ifelse', label: 'Decision with IF / ELSE', text: '< $0 >\nIF YES {\n    \n} ELSE {\n    \n}' },
        { id: 'io', label: 'Input / output', text: '/ $0 /' },
        { id: 'subprocess', label: 'Subprocess', text: '| $0 |' },
        { id: 'database', label: 'Database', text: 'DATABASE "$0"' },
        { id: 'ifelse', label: 'IF / ELSE block', text: 'IF YES {\n    $0\n}\nELSE {\n    \n}' },
      ] },
      { title: 'Directives', items: [
        { id: 'dir-tb', label: 'DIRECTION TB', text: 'DIRECTION TB' },
        { id: 'dir-lr', label: 'DIRECTION LR', text: 'DIRECTION LR' },
        { id: 'layout-radial', label: 'LAYOUT RADIAL', text: 'LAYOUT RADIAL' },
        { id: 'layout-tree', label: 'LAYOUT TREE', text: 'LAYOUT TREE' },
        { id: 'layout-horizontal', label: 'LAYOUT HORIZONTAL', text: 'LAYOUT HORIZONTAL' },
      ] },
      { title: 'MINDMAP elements', items: [
        { id: 'root', label: 'Root topic', text: 'ROOT "$0"' },
        { id: 'root-block', label: 'Root topic with children', text: 'ROOT "$0" {\n    "Topic"\n}' },
        { id: 'topic', label: 'Child topic', text: '"$0"' },
        { id: 'topic-block', label: 'Child topic with children', text: '"$0" {\n    "Subtopic"\n}' },
      ] },
    ],
    find(id) { for (const g of this.groups) for (const i of g.items) if (i.id === id) return i; return null; },
  };
})();
