var ctx = new AudioContext();

var BS = 256 * 4;

var ONES = ctx.createScriptProcessor(BS, 0, 1);
var outputBuffer = new Float32Array(BS);
for (var i = 0; i < BS; i++) outputBuffer[i] = 1;
ONES.onaudioprocess = function (event) {
  event.outputBuffer.getChannelData(0).set(outputBuffer);
}

var ZEROS = ctx.createGain();

var AP = function (defaultValue) {
  var gainNode = ctx.createGain(),
      audioParam;

  ONES.connect(gainNode);

  audioParam = gainNode.gain;
  audioParam.value = defaultValue;
  audioParam.connect = function (destination) {
    gainNode.connect(destination, 0);
  };
  audioParam.disconnect = function () {
    gainNode.disconnect();
  };
  audioParam._nodes = [gainNode];
  return audioParam;
}

var SetVariable = React.createClass({
  render: function () {
    if (!this.props.scope.state.throughs.hasOwnProperty(this.props.name))
      this.props.scope.state.throughs[this.props.name] = ctx.createGain();
    return React.createElement(Attribute, {
      to: this.props.scope.state.throughs[this.props.name],
      ...this.props
    });
  }
});

var Variable = React.createClass({
  connect: function (to) {
    if (!to) return;
    if (!this.props.scope.state.throughs.hasOwnProperty(this.props.name))
      return;
    this.props.scope.state.throughs[this.props.name].connect(to);
  },
  disconnect: function () {
    if (!this.props.scope.state.throughs.hasOwnProperty(this.props.name))
      return;
    this.props.scope.state.throughs[this.props.name].disconnect();
  },
  componentDidMount: function () {
    this.connect(this.props.name, this.props.to);
  },
  componentWillUnmount: function () {
    this.disconnect();
  },
  componentDidUpdate: function () {
    this.disconnect();
    this.connect(this.props.to);
  },
  handleNameChange: function (event) {
    this.props.scope.handleChange(this.props.path.concat(['name']), event.target.value);
  },
  render: function () {
    return (
      <div className="node">
      <select value={this.props.name} onChange={this.handleNameChange}>
      {
	Object.keys(this.props.scope.state.variables).map(function (v) {
	  return <option value={v} key={v}>{v}</option>
	})
      }
      </select>
      </div>
    );
  }
});

var Expression = React.createClass({
  getInitialState: function () {
    return {
      value: this.props.value
    };
  },
  handleChange: function (event) {
    this.props.onChange(event.target.value);
  },
  render: function () {
    return (<input type="text" value={this.props.value} onChange={this.handleChange} />);
  }
});    

var Value = React.createClass({
  getInitialState: function () {
    var node = AP(this.props.value);
    return {
      value: this.props.value,
      node: node
    };
  },
  connect: function (to) {
    if (!to) return;
    this.state.node.connect(to);
  },
  disconnect: function () {
    this.state.node.disconnect();
  },
  componentWillUnmount: function () {
    this.disconnect();
  },
  handleChange: function (event) {
    this.state.node.value = event.target.value;
    this.props.scope.handleChange(this.props.path.concat(['value']), event.target.value);
    this.setState({
      value: event.target.value
    });
  },
  render: function () {
    this.connect(this.props.to);
    return (<input type="number" value={this.state.value} onChange={this.handleChange} />);
  }
});

var Sequence = React.createClass({
  handleValueChange: function (i) {
    return function (event) {
      this.props.scope.handleChange(this.props.path.concat(['values', i]), event.target.value);
    }.bind(this)
  },
  handleClick: function (i, j) {
    return function () {
      this.props.scope.handleChange(this.props.path.concat(['steps', j]), i);
    }.bind(this);
  },
  dupe: function () {
    this.props.scope.handleChange(this.props.path.concat(['steps']), this.props.steps.concat(this.props.steps));
  },
  halve: function () {
    this.props.scope.handleChange(this.props.path.concat(['steps', 'length']), Math.floor(this.props.steps.length / 2));
  },
  times2: function () {
    var newSteps = [];
    for (var i = 0; i < this.props.steps.length; i++) {
      newSteps.push(this.props.steps[i]);
      newSteps.push(this.props.steps[i]);
    }
    this.props.scope.handleChange(this.props.path.concat(['steps']), newSteps);
  },
  addValue: function () {
    this.props.scope.handleChange(this.props.path.concat(['values']), this.props.values.concat([0]));
  },
  render: function () {
    var rows = {};
    for (var i = 0; i < this.props.values.length; i++) {
      var row = [];
      for (var j = 0; j < this.props.steps.length; j++) {
	row.push(<td key={j}
		     className={'step ' + (this.props.steps[j] == i ? 'on' : 'off') + (this.props.index == j ? ' highlight' : '')}
		     style={{width: (100 / this.props.steps.length) + '%' }}
		     onClick={this.handleClick(i, j)} />);
      }
      rows[this.props.values[i]] = row;
    }

    return (
      <div>
      <table style={{width: 200}}>
	<tbody>
	  {
	    this.props.values.map(function (v, i) {
	      return (
		<tr key={v + ' ' + i}>
		  <td>
		    <input key={'value_input_' + v + ' ' + i} className="val" type="number" value={v} onChange={this.handleValueChange(i)} />
		  </td>
		  {
		    rows[v]
		  }
		</tr>
	      );
	    }.bind(this))
	  }
      	</tbody>
	<a href="#" onClick={this.dupe}>dupe</a>
	<a href="#" onClick={this.halve}>halve</a>
	<a href="#" onClick={this.times2}>*2</a>
      </table>
      <a href="#" onClick={this.addValue}>add</a>
      </div>
    );
  }
});

var Attribute = React.createClass({
  getInitialState: function () {
    return {
      dragOver: 0
    };
  },
  handleDrop: function (event) {
    this.setState({
      dragOver: 0
    });
    
    if (!this.props.scope.state.dragging) return;
    this.props.scope.handleMove(this.props.scope.state.dragging, this.props.path);
    this.props.scope.state.dragging = false;
    
    event.preventDefault();
  },
  handleDragEnter: function (event) {
    this.setState({
      dragOver: this.state.dragOver+1
    });
    return true;
  },
  handleDragExit: function () {
    this.setState({
      dragOver: this.state.dragOver-1
    });
//    event.stopPropagation();
  },
  handleDragOver: function (event) {
    if (subpathOf(this.props.path, this.props.scope.state.dragging)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  },
  render: function () {
    return (
      <div className={`attr ${this.state.dragOver ? 'dragOver' : ''}`} onDrop={this.handleDrop} onDragEnter={this.handleDragEnter} onDragExit={this.handleDragExit} onDragOver={this.handleDragOver} onDragLeave={this.handleDragExit}>
	<div>{this.props.name}:</div>
	<Draggable path={this.props.path} scope={this.props.scope}>
	    {
	      React.createElement(this.props.value.tagName, {
		to: this.props.to, scope: this.props.scope, path: this.props.path, ...this.props.value
	      })
	    }
	</Draggable>
      </div>
    );
  }
});
    
var Attributes = React.createClass({
  renderAttribute: function (name) {
    return <Attribute key={name} name={name} value={this.props.attributes[name]} scope={this.props.scope} to={this.props.attributeMap[name]} onChange={this.props.onChange} path={this.props.path.concat(['attributes', name])} />;
  },
  render: function () {
    return <div>{this.props.attributeList.map(this.renderAttribute)}</div>;
  }
});

var Draggable = React.createClass({
  handleDragStart: function (event) {
    this.props.scope.state.dragging = this.props.path;
    event.stopPropagation();
  },
  handleDrag: function (event) {
  },
  handleDragEnd: function () {
    this.props.scope.state.dragging = false;
  },
  render: function () {
    return (
      <div className='draggable'
	   onDrag={this.handleDrag}
	   onDragStart={this.handleDragStart}
	   onDragEnd={this.handleDragEnd}
	   draggable={true}>
	{this.props.children}
      </div>
    );
  }
});

var Osc = React.createClass({
  getInitialState: function () {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var offset = AP(0);
    
    gain.gain.value = 0;
    
    osc.frequency.value = 0;
    osc.type = this.props.type || 'sine';
    osc.start();
    osc.connect(gain);

    gain.connect(offset);
    
    return {
      osc: osc,
      gain: gain,
      offset: offset,
      attributes: this.props.attributes
    }
  },
  connect: function (to) {
    if (!to) return;
    this.state.offset.connect(to);
  },
  disconnect: function () {
    this.state.offset.disconnect();
  },
  componentWillUnmount: function () {
    this.disconnect();
  },
  handleTypeChange: function (event) {
    this.state.osc.type = event.target.value;
    this.props.scope.handleChange(this.props.path.concat(['type']), event.target.value);
  },
  componentDidMount: function () {
    this.connect(this.props.to);
  },
  save: function () {
    return {
      tagName: Osc,
      attributes: this.state.attributes
    };
  },
  render: function () {
    var types = ['sine', 'triangle', 'sawtooth', 'square'];
    return (
      <div className='node'>
	{this.props.name}
	<select onChange={this.handleTypeChange} value={this.props.type}>
	  {types.map(function (t) {
	     return <option key={t} value={t}>{t}</option>;
	   })}
	</select>
	<Attributes attributeList={['frequency', 'gain', 'offset']}
		    attributeMap={{
			frequency: this.state.osc.frequency,
			gain: this.state.gain.gain,
			offset: this.state.offset
		      }}
		    scope={this.props.scope}
		    attributes={this.state.attributes}
		    path={this.props.path} />
      </div>
    );
  }
});

var Sync = React.createClass({
  getInitialState: function () {
    var node = ctx.createScriptProcessor(BS, 1, 1);
    node.onaudioprocess = function (event) {
      var lastTick = this.state.lastTick || 0;
      var frequency = event.inputBuffer.getChannelData(0);
      var output = event.outputBuffer.getChannelData(0);

      for (var i = 0; i < BS; i++) {
	var samplesPerCycle = ctx.sampleRate / frequency[i];
	output[i] = 0;
	if (i >= lastTick + samplesPerCycle) {
	  lastTick = i;
	  output[i] = 1;
	}
      }
      this.state.lastTick = lastTick - BS;
    }.bind(this);

    return {
      node: node
    };
  },
  connect: function (to) {
    if (!to) return;
    if (to == ctx.destination) return;
    this.state.node.connect(to);
  },
  disconnect: function () {
    this.state.node.disconnect();
  },
  componentDidMount: function () {
    this.connect(this.props.to);
  },
  componentWillUnmount: function () {
    this.disconnect();
  },
  render: function () {
    return (
      <div className='node'>
	Sync
	<Attributes attributeList={['frequency']}
		    attributeMap={{
			frequency: this.state.node
		      }}
		    scope={this.props.scope}
		    attributes={this.props.attributes}
		    path={this.props.path} />
      </div>
    );
  }
});
  
var Array = React.createClass({
  getInitialState: function () {
    var node = ctx.createScriptProcessor(BS, 2, 1);
    node.onaudioprocess = function (event) {
      var idx = this.state.idx || 0;
      var lastChange = this.state.lastChange || 0;

      var frequency = event.inputBuffer.getChannelData(0);
      var sync = event.inputBuffer.getChannelData(1);
      //var base = event.inputBuffer.getChannelData(1);
      var output = event.outputBuffer.getChannelData(0);

      for (var i = 0; i < BS; i++) {
	if (sync[i]) {
	  idx = 0;
	  lastChange = 0;
	}
	var samplesPerCycle = ctx.sampleRate / frequency[i];
	if (i >= lastChange + samplesPerCycle) {
	  lastChange = i;
	  idx++;
	  if (this.props.steps.length == 0) idx = 0;
	  else idx = idx % this.props.steps.length;
	}
	output[i] = this.props.values[this.props.steps[idx]] || 0
      }
      if (idx != this.state.idx) {
	this.setState({
	  idx: idx
	});
      }
      this.state.lastChange = lastChange;
      
      this.state.lastChange -= BS;
    }.bind(this);
    
    var gain = ctx.createGain();
    node.connect(gain);
    
    var frequency = ctx.createGain();
    var sync = ctx.createGain();
    var merger = ctx.createChannelMerger(2);
    frequency.connect(merger, 0, 0);
    sync.connect(merger, 0, 1);
    merger.connect(node);
    
    return {
      node: node,
      gain: gain,
      sync: sync,
      frequency: frequency,
      attributes: this.props.attributes
    }
  },
  connect: function (to) {
    if (!to) return;
    if (to == ctx.destination) return;
    this.state.gain.connect(to);
  },
  disconnect: function () {
    this.state.gain.disconnect();
  },
  handleValuesChange: function (vals) {
    this.props.scope.handleChange(this.props.path.concat(['values']), vals);
  },
  componentDidMount: function () {
    this.connect(this.props.to);
  },
  componentWillUnmount: function () {
    this.disconnect();
  },
  render: function () {
    return (
      <div className='node'>
      <Sequence values={this.props.values} steps={this.props.steps} onChange={this.handleValuesChange} scope={this.props.scope} path={this.props.path} index={this.state.idx} />
      <Attributes attributeList={['base', 'frequency', 'sync']}
		  attributeMap={{
		      base: this.state.gain.gain,
		      frequency: this.state.frequency,
		      sync: this.state.sync
		    }}
		  scope={this.props.scope}
		  attributes={this.state.attributes}
		  path={this.props.path} />
      </div>
    );
  }
});

var Arithmetic = React.createClass({
  initNode: function () {
    var node = ctx.createScriptProcessor(BS, this.state.vars.length, 1);
    var varMap = {};
    for (var i = 0; i < this.state.vars.length; i++) {
      varMap[this.state.vars[i]] = i;
    }

    node.onaudioprocess = function (event) {
      var output = event.outputBuffer.getChannelData(0);
      for (var i = 0; i < BS; i++) {
	var scope = {};
	for (var k in varMap) {
	  scope[k] = event.inputBuffer.getChannelData(varMap[k])[i];
	}
	output[i] = this.state.expression.eval(scope);
      }
    }.bind(this);

    for (var i = 0; i < this.state.vars.length; i++) {
      if (!this.state.throughs.hasOwnProperty(this.state.vars[i]))
	this.state.throughs[this.state.vars[i]] = ctx.createGain();
      this.state.throughs[this.state.vars[i]].connect(node, 0, i);
    }

    return node;
  },
  getInitialState: function () {
    var exp = math.compile(this.props.expression);
    
    return {
      expression: exp,
      node: null,
      vars: ['x'],
      throughs: {}
    };
  },
  handleExpressionChange: function (exp) {
    try {
      this.state.expression = math.compile(exp);
    } catch (e) {}
    this.props.scope.handleChange(this.props.path.concat(['expression']), exp);
  },
  connect: function (to) {
    if (!to) return;
    this.state.node.connect(to);
  },
  disconnect: function () {
    this.state.node.disconnect();
  },
  componentDidMount: function () {
    if (this.state.node == null)
      this.state.node = this.initNode();

    this.connect(this.props.to);
  },
  componentWillUnmount: function () {
    this.disconnect();
  },
  render: function () {
    return (
      <div className='node'>
      <Expression onChange={this.handleExpressionChange} value={this.props.expression} />
      <Attributes attributeList={Object.keys(this.props.attributes)}
		  attributeMap={this.state.throughs}
		  scope={this.props.scope}
		  attributes={this.props.attributes}
		  path={this.props.path} />
      </div>
    );
  }
});

var Scope = React.createClass({
  getInitialState: function () {
    return {
      throughs: {},
      destination: this.props.destination,
      variables: this.props.variables,
      dragging: false,
      newVariableName: ''
    };
  },
  handleNameChange: function (event) {
    this.setState({
      newVariableName: event.target.value
    });
  },
  handleAddClick: function (thing) {
    return function () {
      var newNode;
      if (thing == 'oscillator')
	newNode = {
	  tagName: Osc,
	  type: 'sine',
	  attributes: {
	    frequency: { tagName: Value, value: 110 },
	    gain: { tagName: Value, value: 1 },
	    offset: { tagName: Value, value: 0 }
	  }
	};
      if (thing == 'array')
	newNode = {
	  tagName: Array,
	  values: [1, 1.5, 1.6],
	  steps: [0, 0, 2, 1],
	  attributes: {
	    frequency: { tagName: Value, value: 1 },
	    base: { tagName: Value, value: 110 },
	    sync: { tagName: Value, value: 0 }
	  }
	};
      if (thing == 'expression')
	newNode = {
	  tagName: Arithmetic,
	  expression: 'x',
	  attributes: {
	    x: { tagName: Value, value: 0 }
	  }
	};
      if (thing == 'variable')
	newNode = {
	  tagName: Variable,
	  name: Object.keys(this.state.variables)[0],
	  attributes: {}
	};
      if (thing == 'sync')
	newNode = {
	  tagName: Sync,
	  attributes: {
	    frequency: { tagName: Value, value: 0 }
	  }
	};
      var r = Math.random();
      var dest = this.state.destination;
      dest[r] = newNode;
      this.setState({
	destination: dest
      });
    }.bind(this);
  },
  handleAddVariable: function () {
    var vars = this.state.variables;
    vars[this.state.newVariableName] = { tagName: Value, value: 0 };
    this.setState({
      variables: vars,
      newVariableName: ''
    });
  },
  handleChange: function (path, value) {
    this.setState(Change(this.state, path, value));
  },
  handleDelete: function (path) {
    this.setState(Delete(this.state, path));
  },
  handleMove: function (from, to) {
    this.setState(Change(
      Change(this.state, to, Get(this.state, from)),
      from,
      from.length == 2 ? undefined : { tagName: Value, value: 0 }
    ));
  },
  renderVariables: function (vars) {
    var ret = [];
    for (var k in vars) {
      ret.push(<SetVariable key={k} name={k} value={vars[k]} scope={this} path={['variables', k]} />);
    }
    return ret;
  },
  renderDestination: function (dest) {
    if (!dest) return [];

    var ret = [];
    for (var k in dest) {
      ret.push(
	<Draggable name={k} key={k} data={dest[k]} path={['destination', k]} scope={this}>
	  {
	    React.createElement(dest[k].tagName, {
	      path: ['destination', k],
	      scope: this,
	      to: ctx.destination,
	      ...dest[k]
	    })
	  }
	</Draggable>
      );
    }
    return ret;
  },
  render: function () {
    return (
      <div>
	<div>Add:
	  <div>
	    <input type="text" value={this.state.newVariableName} onChange={this.handleNameChange} placeholder="name" />
	    <a href="#" onClick={this.handleAddVariable}>new var</a>
	  </div>
	  <div>
	    <a href="#" onClick={this.handleAddClick('oscillator')}>oscillator</a>
	    <a href="#" onClick={this.handleAddClick('array')}>array</a>
	    <a href="#" onClick={this.handleAddClick('expression')}>expression</a>
	    <a href="#" onClick={this.handleAddClick('variable')}>get var</a>
	    <a href="#" onClick={this.handleAddClick('sync')}>sync</a>
	  </div>
	</div>
	{this.renderVariables(this.state.variables)}
	{this.renderDestination(this.state.destination)}
      </div>
    );
  }
});

var blankData = {
  variables: {},
  destination: {
    t: {
      tagName: Osc,
      type: 'sine',
      attributes: {
	frequency: { tagName: Value, value: 110 },
	gain: { tagName: Value, value: 1 },
	offset: { tagName: Value, value: 0 }
      }
    }
  }
};

function Change(original, path, value) {
  if (value === undefined || value === false || value === null) return Delete(original, path);
  if (path.length == 0) return value;
  original[path[0]] = Change(original[path[0]], path.slice(1), value);
  return original;
};

function Delete(original, path) {
  if (path.length == 0) return original;
  if (path.length == 1) {
    delete original[path[0]];
    return original;
  }
  original[path[0]] = Delete(original[path[0]], path.slice(1));
  return original;
};

function Get(original, path) {
  if (path.length == 0) return original;
  return Get(original[path[0]], path.slice(1));
};

function subpathOf(a, b) {
  // returns true if a is a subpath of b
  if (a.length == 0)
    return b.length == 0;
  if (b.length == 0) return true
  if (b[0] != a[0]) return false;
  return subpathOf(a.slice(1), b.slice(1));
};

var blank = (
  <Scope name='test'
	 variables={blankData.variables}
	 destination={blankData.destination}
  />
);

ReactDOM.render(
  blank,
  document.getElementById('root')
);
