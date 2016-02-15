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
    return (
      <div className="node">
      <span className='var'>{this.props.name}</span>
      {
	React.cloneElement(this.props.value, {
	  to: this.props.scope.state.throughs[this.props.name],
	  scope: this.props.scope
	})
      }
      </div>
    );
  }
});

var Variable = React.createClass({
  connect: function (to) {
    if (!to) return;
    if (!this.props.scope.state.throughs.hasOwnProperty(this.props.name))
      this.props.scope.state.throughs[this.props.name] = ctx.createGain();
    this.props.scope.state.throughs[this.props.name].connect(to);
  },
  render: function () {
    this.connect(this.props.to);
    return <span className='var'>{this.props.name}</span>
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

var List = React.createClass({
  handleChange: function (event) {
    if (this.props.onChange) {
      this.props.onChange(event.target.value.split(/[ ,]+/).map(function (s) { return parseFloat(s) || 0; }));
    }
  },
  render: function () {
    return (<input type="text" value={this.props.values} onChange={this.handleChange} />);
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
    if (event.handled) return;
    event.handled = true;

    this.props.scope.handleMove(event.dragging, this.props.path);
    event.dragging = false;
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
    event.preventDefault();
    event.stopPropagation();
  },
  render: function () {
    return (
      <div className={`attr ${this.state.dragOver ? 'dragOver' : ''}`} onDrop={this.handleDrop} onDragEnter={this.handleDragEnter} onDragExit={this.handleDragExit} onDragOver={this.handleDragOver} onDragLeave={this.handleDragExit}>
	{this.props.name}:
	<Draggable path={this.props.path}>
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
  handleDrag: function (event) {
    event.handled = false;
    if (!event.dragging) {
      event.dragging = this.props.path;
    }
  },
  render: function () {
    return (
      <div className='draggable'
	   onDrag={this.handleDrag}
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

var Array = React.createClass({
  getInitialState: function () {
    var node = ctx.createScriptProcessor(BS, 1, 1);
    node.onaudioprocess = function (event) {
      var idx = this.state.idx || 0;
      var lastChange = this.state.lastChange || 0;

      var frequency = event.inputBuffer.getChannelData(0);
      //var base = event.inputBuffer.getChannelData(1);
      var output = event.outputBuffer.getChannelData(0);

      for (var i = 0; i < BS; i++) {
	var samplesPerCycle = ctx.sampleRate / frequency[i];
	if (i >= lastChange + samplesPerCycle) {
	  lastChange = i;
	  idx++;
	  if (this.props.values.length == 0) idx = 0;
	  else idx = idx % this.props.values.length;
	}
	output[i] = this.props.values[idx] || 0
      }
      this.state.idx = idx;
      this.state.lastChange = lastChange;
      
      this.state.lastChange -= BS;
    }.bind(this);
    
    var gain = ctx.createGain();
    node.connect(gain);
    
    var frequency = AP(0);
    frequency.connect(node);
    
    return {
      node: node,
      gain: gain,
      frequency: frequency,
      attributes: this.props.attributes
    }
  },
  connect: function (to) {
    if (!to) return;
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
      <List values={this.props.values} onChange={this.handleValuesChange} />
      <Attributes attributeList={['base', 'frequency']}
		  attributeMap={{
		      base: this.state.gain.gain,
		      frequency: this.state.frequency
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
      destination: this.props.destination
    };
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
	  values: [1, 1, 1.6, 1.5],
	  attributes: {
	    frequency: { tagName: Value, value: 1 },
	    base: { tagName: Value, value: 110 }
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
      var r = Math.random();
      var dest = this.state.destination;
      dest[r] = newNode;
      this.setState({
	destination: dest
      });
    }.bind(this);
  },
  handleChange: function (path, value) {
    console.log(path, value);
    this.setState(Change(this.state, path, value));
  },
  handleDelete: function (path) {
    this.setState(Delete(this.state, path));
  },
  handleMove: function (from, to) {
    this.setState(Change(
      Change(this.state, to, Get(this.state, from)),
      from,
      { tagName: Value, value: 0 }
    ));
  },
  renderVariables: function (vars) {
    var ret = [];
    for (var k in vars) {
      ret.push(<SetVariable key={k} name={k} value={vars[k]} scope={this} />);
    }
    return ret;
  },
  renderDestination: function (dest) {
    if (!dest) return [];

    var ret = [];
    for (var k in dest) {
      ret.push(
	<Draggable name={k} key={k} data={dest[k]} path={['destination', k]}>
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
	  <a href="#" onClick={this.handleAddClick('oscillator')}>oscillator</a>
	  <a href="#" onClick={this.handleAddClick('array')}>array</a>
	  <a href="#" onClick={this.handleAddClick('expression')}>expression</a>
	</div>
	{this.renderVariables(this.props.variables)}
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
