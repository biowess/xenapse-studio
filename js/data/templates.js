/* Xenapse Studio template catalog.
   Provides standard templates for FLOW and MINDMAP diagrams.
   All templates adhere strictly to the Xenapse Language specification (docs/DECISIONS.md). */
(function () {
  const TEMPLATES = [
    {
      id: 'flow-basic-process',
      name: 'Basic Process',
      category: 'FLOW',
      module: 'FLOW',
      stem: 'basic-process',
      desc: 'A linear process sequence progressing step by step from start to finish.',
      xnp: `IMPORT FLOW
DIRECTION TB

START
[ Step 1: Initialize ]
[ Step 2: Process Data ]
[ Step 3: Finalize Output ]
END
`,
      xcss: null,
      previewSvg: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="74" y="8" width="52" height="18" rx="9" class="tpl-node tpl-node--term" />
        <text x="100" y="17" class="tpl-text tpl-text--term">START</text>
        <path d="M100 26V35" class="tpl-edge" />
        <path d="M98 32L100 35L102 32" class="tpl-arrow" />
        <rect x="45" y="35" width="110" height="20" rx="4" class="tpl-node tpl-node--proc" />
        <text x="100" y="45" class="tpl-text">1. Initialize Pipeline</text>
        <path d="M100 55V64" class="tpl-edge" />
        <path d="M98 61L100 64L102 61" class="tpl-arrow" />
        <rect x="45" y="64" width="110" height="20" rx="4" class="tpl-node tpl-node--proc" />
        <text x="100" y="74" class="tpl-text">2. Process &amp; Transform</text>
        <path d="M100 84V93" class="tpl-edge" />
        <path d="M98 90L100 93L102 90" class="tpl-arrow" />
        <rect x="74" y="93" width="52" height="18" rx="9" class="tpl-node tpl-node--term" />
        <text x="100" y="102" class="tpl-text tpl-text--term">END</text>
      </svg>`,
    },
    {
      id: 'flow-decision-flow',
      name: 'Decision Flow',
      category: 'FLOW',
      module: 'FLOW',
      stem: 'decision-flow',
      desc: 'Branching logic evaluating conditions with Yes and Else resolution paths.',
      xnp: `IMPORT FLOW
STYLESHEET "decision-flow.xcss"
DIRECTION TB

START
[ Review Submission ]
< Approved? >
IF YES {
  [ Issue Authorization ]
  ( Confirmation Sent )
} ELSE {
  [ Request Revisions ]
  ( Notification Sent )
}
[ Update Records ]
END
`,
      xcss: {
        declared: 'decision-flow.xcss',
        text: `/* Decision Flow Styles */
node.decision {
  fill: #F6E9E2;
  stroke: #A55B3F;
}

edge.yes {
  stroke: #3F7A57;
}

edge.no {
  stroke: #A3392F;
}
`,
      },
      previewSvg: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="76" y="6" width="48" height="15" rx="7.5" class="tpl-node tpl-node--term" />
        <text x="100" y="13.5" class="tpl-text tpl-text--term">START</text>
        <path d="M100 21V29" class="tpl-edge" />
        <path d="M98 26L100 29L102 26" class="tpl-arrow" />
        <path d="M100 29L135 44L100 59L65 44Z" class="tpl-node tpl-node--dec" />
        <text x="100" y="44" class="tpl-text">Approved?</text>
        <!-- YES branch -->
        <path d="M65 44H34V67" class="tpl-edge tpl-edge--yes" />
        <path d="M32 64L34 67L36 64" class="tpl-arrow tpl-arrow--yes" />
        <rect x="12" y="67" width="44" height="18" rx="3" class="tpl-node tpl-node--proc" />
        <text x="34" y="76" class="tpl-text" style="font-size: 6.5px;">Authorize</text>
        <!-- NO branch -->
        <path d="M135 44H166V67" class="tpl-edge tpl-edge--no" />
        <path d="M164 64L166 67L168 64" class="tpl-arrow tpl-arrow--no" />
        <rect x="144" y="67" width="44" height="18" rx="3" class="tpl-node tpl-node--proc" />
        <text x="166" y="76" class="tpl-text" style="font-size: 6.5px;">Revisions</text>
        <!-- Merge -->
        <path d="M34 85V98H100" class="tpl-edge" />
        <path d="M166 85V98H100" class="tpl-edge" />
        <path d="M100 98V104" class="tpl-edge" />
        <rect x="76" y="104" width="48" height="13" rx="6.5" class="tpl-node tpl-node--term" />
        <text x="100" y="110.5" class="tpl-text tpl-text--term">END</text>
      </svg>`,
    },
    {
      id: 'flow-input-output',
      name: 'Input and Output',
      category: 'FLOW',
      module: 'FLOW',
      stem: 'input-output',
      desc: 'Horizontal pipeline tracking raw data ingestion, processing, and output delivery.',
      xnp: `IMPORT FLOW
DIRECTION LR

START
/ Ingest Raw Dataset /
[ Clean and Normalize ]
| Validate Schema |
/ Export Processed Report /
END
`,
      xcss: null,
      previewSvg: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="6" y="48" width="28" height="22" rx="11" class="tpl-node tpl-node--term" />
        <text x="20" y="59" class="tpl-text tpl-text--term" style="font-size: 6px;">START</text>
        <path d="M34 59H44" class="tpl-edge" />
        <path d="M41 57L44 59L41 61" class="tpl-arrow" />
        <polygon points="50,72 58,46 90,46 82,72" class="tpl-node tpl-node--io" />
        <text x="70" y="59" class="tpl-text" style="font-size: 6.5px;">/ Ingest /</text>
        <path d="M86 59H96" class="tpl-edge" />
        <path d="M93 57L96 59L93 61" class="tpl-arrow" />
        <rect x="96" y="47" width="46" height="24" rx="4" class="tpl-node tpl-node--proc" />
        <text x="119" y="59" class="tpl-text" style="font-size: 6.5px;">[ Clean ]</text>
        <path d="M142 59H152" class="tpl-edge" />
        <path d="M149 57L152 59L149 61" class="tpl-arrow" />
        <polygon points="156,72 164,46 196,46 188,72" class="tpl-node tpl-node--io" />
        <text x="176" y="59" class="tpl-text" style="font-size: 6.5px;">/ Export /</text>
      </svg>`,
    },
    {
      id: 'flow-conditional-workflow',
      name: 'Conditional Workflow',
      category: 'FLOW',
      module: 'FLOW',
      stem: 'conditional-workflow',
      desc: 'Multi-tiered conditional routing with nested verification steps and terminal branches.',
      xnp: `IMPORT FLOW
DIRECTION TB

START
/ User Request /
< Authenticated? >
IF YES {
  < Has Permission? >
  IF YES {
    [ Grant Access ]
    ( Session Started )
  } ELSE {
    [ Log Unauthorized Attempt ]
    ( Access Denied )
    END
  }
} ELSE {
  | Prompt Multi-Factor Login |
  ( Redirect to Auth )
}
[ Audit Log Entry ]
END
`,
      xcss: null,
      previewSvg: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polygon points="76,19 82,7 124,7 118,19" class="tpl-node tpl-node--io" />
        <text x="100" y="13" class="tpl-text" style="font-size: 6px;">Request</text>
        <path d="M100 19V26" class="tpl-edge" />
        <path d="M100 26L122 36L100 46L78 36Z" class="tpl-node tpl-node--dec" />
        <text x="100" y="36" class="tpl-text" style="font-size: 6px;">Auth?</text>
        <!-- No auth -->
        <path d="M78 36H42V52" class="tpl-edge" />
        <rect x="22" y="52" width="40" height="18" rx="3" class="tpl-node tpl-node--proc" />
        <text x="42" y="61" class="tpl-text" style="font-size: 6px;">MFA Login</text>
        <!-- Auth yes -> nested check -->
        <path d="M122 36H155V50" class="tpl-edge" />
        <path d="M155 50L174 59L155 68L136 59Z" class="tpl-node tpl-node--dec" />
        <text x="155" y="59" class="tpl-text" style="font-size: 5.5px;">Perms?</text>
        <path d="M136 59H118V76" class="tpl-edge" />
        <rect x="98" y="76" width="40" height="16" rx="3" class="tpl-node tpl-node--proc" />
        <text x="118" y="84" class="tpl-text" style="font-size: 5.5px;">Grant Access</text>
        <path d="M174 59H188V76" class="tpl-edge" />
        <rect x="170" y="76" width="26" height="16" rx="8" class="tpl-node tpl-node--term" />
        <text x="183" y="84" class="tpl-text tpl-text--term" style="font-size: 5.5px;">Deny</text>
        <path d="M42 70V104H100" class="tpl-edge" />
        <path d="M118 92V104H100" class="tpl-edge" />
        <path d="M100 104V108" class="tpl-edge" />
        <rect x="76" y="108" width="48" height="10" rx="3" class="tpl-node tpl-node--proc" />
        <text x="100" y="113" class="tpl-text" style="font-size: 5.5px;">Audit Log</text>
      </svg>`,
    },
    {
      id: 'flow-database-workflow',
      name: 'Database Workflow',
      category: 'FLOW',
      module: 'FLOW',
      stem: 'database-workflow',
      desc: 'Data tier coordination demonstrating memory cache checks and database storage.',
      xnp: `IMPORT FLOW
STYLESHEET "database-workflow.xcss"
DIRECTION TB

START
/ Incoming Query /
< Cached in Memory? >
IF YES {
  [ Serve from Cache ]
} ELSE {
  | Fetch from Store |
  DATABASE "PostgreSQL Primary"
  [ Populate Cache ]
}
/ Return Result /
END
`,
      xcss: {
        declared: 'database-workflow.xcss',
        text: `/* Database Workflow Styles */
diagram {
  rank-gap: 40px;
}

node.database {
  fill: #ECEEF0;
  stroke: #5C6770;
}
`,
      },
      previewSvg: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polygon points="76,17 82,7 124,7 118,17" class="tpl-node tpl-node--io" />
        <text x="100" y="12" class="tpl-text" style="font-size: 6px;">Query</text>
        <path d="M100 17V24" class="tpl-edge" />
        <path d="M100 24L124 35L100 46L76 35Z" class="tpl-node tpl-node--dec" />
        <text x="100" y="35" class="tpl-text" style="font-size: 6px;">Cached?</text>
        <path d="M76 35H45V54" class="tpl-edge" />
        <rect x="25" y="54" width="40" height="18" rx="3" class="tpl-node tpl-node--proc" />
        <text x="45" y="63" class="tpl-text" style="font-size: 6px;">Cache Hit</text>
        <path d="M124 35H155V48" class="tpl-edge" />
        <!-- 3D cylinder -->
        <path d="M136 53C136 49 174 49 174 53V71C174 75 136 75 136 71Z" class="tpl-node tpl-node--db" />
        <ellipse cx="155" cy="53" rx="19" ry="4" class="tpl-node tpl-node--db" />
        <text x="155" y="64" class="tpl-text" style="font-size: 6px;">PostgreSQL</text>
        <path d="M45 72V94H100" class="tpl-edge" />
        <path d="M155 73V94H100" class="tpl-edge" />
        <polygon points="80,114 86,102 120,102 114,114" class="tpl-node tpl-node--io" />
        <text x="100" y="108" class="tpl-text" style="font-size: 6px;">Return Result</text>
      </svg>`,
    },
    {
      id: 'mindmap-simple-mindmap',
      name: 'Simple Mind Map',
      category: 'MINDMAP',
      module: 'MINDMAP',
      stem: 'simple-mindmap',
      desc: 'Radial ideation structure radiating outward to explore key concepts and associations.',
      xnp: `IMPORT MINDMAP
LAYOUT RADIAL

ROOT "Central Theme" {
  "Research" {
    "Interviews"
    "Literature"
  }
  "Design" {
    "Wireframes"
    "Prototypes"
  }
  "Execution" {
    "Milestones"
    "Deliverables"
  }
}
`,
      xcss: null,
      previewSvg: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Central Hub -->
        <rect x="70" y="47" width="60" height="26" rx="13" class="tpl-node tpl-node--root" />
        <text x="100" y="60" class="tpl-text tpl-text--root">Central Theme</text>
        <!-- Top Branch -->
        <path d="M100 47C100 32 100 28 100 22" class="tpl-edge" />
        <rect x="74" y="8" width="52" height="15" rx="4" class="tpl-node tpl-node--topic" />
        <text x="100" y="15.5" class="tpl-text">Research</text>
        <!-- Left Branch -->
        <path d="M70 60C50 60 45 60 38 60" class="tpl-edge" />
        <rect x="8" y="52" width="46" height="16" rx="4" class="tpl-node tpl-node--topic" />
        <text x="31" y="60" class="tpl-text">Design</text>
        <!-- Right Branch -->
        <path d="M130 60C150 60 155 60 162 60" class="tpl-edge" />
        <rect x="146" y="52" width="46" height="16" rx="4" class="tpl-node tpl-node--topic" />
        <text x="169" y="60" class="tpl-text">Execution</text>
        <!-- Bottom Branch -->
        <path d="M100 73C100 88 100 92 100 98" class="tpl-edge" />
        <rect x="74" y="97" width="52" height="15" rx="4" class="tpl-node tpl-node--topic" />
        <text x="100" y="104.5" class="tpl-text">Milestones</text>
      </svg>`,
    },
    {
      id: 'mindmap-hierarchical-mindmap',
      name: 'Hierarchical Mind Map',
      category: 'MINDMAP',
      module: 'MINDMAP',
      stem: 'hierarchical-mindmap',
      desc: 'Top-down tidy tree layout categorizing structured architectures and nested systems.',
      xnp: `IMPORT MINDMAP
LAYOUT TREE

ROOT "System Architecture" {
  "Frontend" {
    "UI Components"
    "State Store"
    "Event Bridge"
  }
  "Backend Engine" {
    "Parser"
    "Layout Solver"
    "Renderer"
  }
  "Storage" {
    "Document Registry"
    "Local Preferences"
  }
}
`,
      xcss: null,
      previewSvg: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="62" y="6" width="76" height="18" rx="9" class="tpl-node tpl-node--root" />
        <text x="100" y="15" class="tpl-text tpl-text--root">Architecture</text>
        <path d="M100 24V36M38 36H162M38 36V48M100 36V48M162 36V48" class="tpl-edge" />
        <rect x="14" y="48" width="48" height="16" rx="3" class="tpl-node tpl-node--topic" />
        <text x="38" y="56" class="tpl-text">Frontend</text>
        <rect x="76" y="48" width="48" height="16" rx="3" class="tpl-node tpl-node--topic" />
        <text x="100" y="56" class="tpl-text">Engine</text>
        <rect x="138" y="48" width="48" height="16" rx="3" class="tpl-node tpl-node--topic" />
        <text x="162" y="56" class="tpl-text">Storage</text>
        <!-- Leaf links -->
        <path d="M38 64V76M24 76H52M24 76V86M52 76V86" class="tpl-edge" />
        <rect x="12" y="86" width="24" height="12" rx="2" class="tpl-node tpl-node--leaf" />
        <text x="24" y="92" class="tpl-text" style="font-size: 5px;">UI</text>
        <rect x="40" y="86" width="24" height="12" rx="2" class="tpl-node tpl-node--leaf" />
        <text x="52" y="92" class="tpl-text" style="font-size: 5px;">State</text>
        <path d="M100 64V86" class="tpl-edge" />
        <rect x="88" y="86" width="24" height="12" rx="2" class="tpl-node tpl-node--leaf" />
        <text x="100" y="92" class="tpl-text" style="font-size: 5px;">Solver</text>
        <path d="M162 64V86" class="tpl-edge" />
        <rect x="150" y="86" width="24" height="12" rx="2" class="tpl-node tpl-node--leaf" />
        <text x="162" y="92" class="tpl-text" style="font-size: 5px;">Disk</text>
      </svg>`,
    },
    {
      id: 'mindmap-radial-mindmap',
      name: 'Radial Mind Map',
      category: 'MINDMAP',
      module: 'MINDMAP',
      stem: 'radial-mindmap',
      desc: 'Multi-directional radial overview distributing branches evenly in a 360-degree radius.',
      xnp: `IMPORT MINDMAP
LAYOUT RADIAL

ROOT "Product Strategy" {
  "Market" {
    "Audience"
    "Competitors"
  }
  "Core Pillars" {
    "Reliability"
    "Simplicity"
    "Speed"
  }
  "Channels" {
    "Community"
    "Direct"
  }
  "Metrics" {
    "Adoption"
    "Retention"
  }
}
`,
      xcss: null,
      previewSvg: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="68" y="48" width="64" height="24" rx="12" class="tpl-node tpl-node--root" />
        <text x="100" y="60" class="tpl-text tpl-text--root">Strategy</text>
        <!-- Top Left -->
        <path d="M78 48C62 34 52 28 42 22" class="tpl-edge" />
        <rect x="14" y="14" width="46" height="16" rx="4" class="tpl-node tpl-node--topic" />
        <text x="37" y="22" class="tpl-text">Market</text>
        <!-- Top Right -->
        <path d="M122 48C138 34 148 28 158 22" class="tpl-edge" />
        <rect x="140" y="14" width="46" height="16" rx="4" class="tpl-node tpl-node--topic" />
        <text x="163" y="22" class="tpl-text">Pillars</text>
        <!-- Bottom Left -->
        <path d="M78 72C62 86 52 92 42 98" class="tpl-edge" />
        <rect x="14" y="90" width="46" height="16" rx="4" class="tpl-node tpl-node--topic" />
        <text x="37" y="98" class="tpl-text">Channels</text>
        <!-- Bottom Right -->
        <path d="M122 72C138 86 148 92 158 98" class="tpl-edge" />
        <rect x="140" y="90" width="46" height="16" rx="4" class="tpl-node tpl-node--topic" />
        <text x="163" y="98" class="tpl-text">Metrics</text>
      </svg>`,
    },
    {
      id: 'mindmap-brainstorming-map',
      name: 'Brainstorming Map',
      category: 'MINDMAP',
      module: 'MINDMAP',
      stem: 'brainstorming-map',
      desc: 'Horizontal ideation tree expanding from left to right for rapid brainstorming.',
      xnp: `IMPORT MINDMAP
LAYOUT HORIZONTAL

ROOT "New Initiative" {
  "Opportunities" {
    "Automation"
    "Efficiency"
  }
  "Challenges" {
    "Resource Constraints"
    "Time to Market"
  }
  "Action Items" {
    "Proof of Concept"
    "Stakeholder Review"
  }
}
`,
      xcss: null,
      previewSvg: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Root on left -->
        <rect x="8" y="47" width="54" height="26" rx="13" class="tpl-node tpl-node--root" />
        <text x="35" y="60" class="tpl-text tpl-text--root">Initiative</text>
        <!-- Branches -->
        <path d="M62 60H80M80 24V96M80 24H98M80 60H98M80 96H98" class="tpl-edge" />
        <rect x="98" y="16" width="48" height="16" rx="3" class="tpl-node tpl-node--topic" />
        <text x="122" y="24" class="tpl-text">Opportunities</text>
        <rect x="98" y="52" width="48" height="16" rx="3" class="tpl-node tpl-node--topic" />
        <text x="122" y="60" class="tpl-text">Challenges</text>
        <rect x="98" y="88" width="48" height="16" rx="3" class="tpl-node tpl-node--topic" />
        <text x="122" y="96" class="tpl-text">Action Items</text>
        <!-- Leaves -->
        <path d="M146 24H160M146 60H160M146 96H160" class="tpl-edge" />
        <rect x="160" y="18" width="32" height="12" rx="2" class="tpl-node tpl-node--leaf" />
        <text x="176" y="24" class="tpl-text" style="font-size: 5.5px;">Auto</text>
        <rect x="160" y="54" width="32" height="12" rx="2" class="tpl-node tpl-node--leaf" />
        <text x="176" y="60" class="tpl-text" style="font-size: 5.5px;">Time</text>
        <rect x="160" y="90" width="32" height="12" rx="2" class="tpl-node tpl-node--leaf" />
        <text x="176" y="96" class="tpl-text" style="font-size: 5.5px;">PoC</text>
      </svg>`,
    },
  ];

  Xen.templates = {
    categories: ['FLOW', 'MINDMAP'],
    list: TEMPLATES,
    get: (id) => TEMPLATES.find((t) => t.id === id) || null,
    byCategory: (cat) => (!cat || cat === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat)),
  };
})();
