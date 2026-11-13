/* Demonstration documents. Source text only; nothing here is compiled. */
(function () {
  const CLINICAL_XNP = `IMPORT FLOW
STYLESHEET "clinical-workflow.xcss"

START

/ Receive patient /

[ Clinical assessment ] #assessment

< Hemodynamically stable? >
IF YES {
    [ Routine investigations ]
}
ELSE {
    | Emergency stabilization |
}

END
`;
  const CLINICAL_XCSS = `/* Clinical workflow theme */
diagram {
    rank-gap: 44px;
}

node {
    fill: #E8EFED;
    stroke: #4B7571;
}

.process {
    border-radius: 8px;
}

.decision {
    fill: #FFFAEB;
    stroke: #B54708;
}

.subprocess {
    stroke-width: 2;
}

#assessment {
    stroke-width: 2;
}

edge {
    stroke: #667085;
}

edge.yes {
    stroke: #067647;
}

edge.no {
    stroke: #B42318;
}
`;
  const MINDMAP_XNP = `IMPORT MINDMAP
LAYOUT RADIAL

ROOT "Patient care" {
    "Assessment" {
        "History"
        "Examination"
        "Investigations"
    }
    "Treatment" {
        "Medication"
        "Procedures"
    }
    "Follow-up" {
        "Review schedule"
        "Patient education"
    }
}
`;
  Xen.samples = {
    clinical: { id: 'clinical', title: 'Clinical workflow', desc: 'A FLOW diagram with an external stylesheet.', module: 'FLOW', icon: 'flow', name: 'clinical-workflow', xnp: CLINICAL_XNP, xcss: { text: CLINICAL_XCSS } },
    mindmap: { id: 'mindmap', title: 'Patient care mind map', desc: 'A MINDMAP with three topics, no stylesheet.', module: 'MINDMAP', icon: 'mindmap', name: 'patient-care', xnp: MINDMAP_XNP, xcss: null },
    'blank-flow': { id: 'blank-flow', title: 'Blank FLOW document', desc: 'Starts with IMPORT FLOW, START and END.', module: 'FLOW', icon: 'blank', name: 'untitled', xnp: 'IMPORT FLOW\n\nSTART\n\nEND\n', xcss: null },
    'blank-mindmap': { id: 'blank-mindmap', title: 'Blank MINDMAP document', desc: 'Starts with IMPORT MINDMAP and a root topic.', module: 'MINDMAP', icon: 'blank', name: 'untitled', xnp: 'IMPORT MINDMAP\n\nROOT "Central idea"\n', xcss: null },
  };
  Xen.samples.STARTER_XCSS = `/* Stylesheet */\nnode {\n    fill: #E8EFED;\n    stroke: #4B7571;\n}\n`;
})();
