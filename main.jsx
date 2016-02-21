var ctx = new AudioContext();

var BS = window.location.search
       ? (Math.pow(2, parseInt(window.location.search.slice(1)))*256)
  : 256 * 4;

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
  getInitialState: function () {
    var attrsToPaths = this.props.scope.getAttributeMap(this.props.name);
    var throughs = {};
    var hasAttrs = false;
    var attributes = Store.get(this.props.path.concat(['attributes']));
    for (var k in attrsToPaths) {
      hasAttrs = true;
      if (!attributes.hasOwnProperty(k))
	attributes[k] = { tagName: Value, value: 0 };
      throughs[k] = ctx.createGain();
      attrsToPaths[k] = attrsToPaths[k].map(function (p) {
	return this.props.path.concat(['element']).concat(p);
      }.bind(this));
    }

    var node;
    if (hasAttrs) {
      node = ctx.createGain();
    } else {
      node = this.props.scope.state.throughs[this.props.name];
    }
    
    return {
      attrsToPaths: attrsToPaths,
      attributes: attributes,
      throughs: throughs,
      node: node
    };
  },
  connect: function (to) {
    if (!to) return;
    if (!this.state.node) return;
    this.state.node.connect(to);
  },
  disconnect: function (to) {
    if (!this.state.node) return;
    this.state.node.disconnect(to);
  },
  handleDataChange: function (path, value) {
    if (subpathOf(path, this.props.path)) {
      let p = path.slice(this.props.path.length);
      if (p.length == 0 || p[0] == 'name')
	this.forceUpdate();
      return;
    }

    if (subpathOf(path, ['variables', this.props.name])) {
      Store.set(this.props.path.concat(['element']),
		copy(Store.get(['variables', this.props.name])));
    }
  },
  componentWillMount: function () {
    Store.set(this.props.path.concat(['attributes']), this.state.attributes);
    
    var val = Store.get(['variables', this.props.name]);
    var v = copy(val);
    Store.set(this.props.path.concat(['element']), v);
  },
  componentDidMount: function () {
    Store.on('CHANGED', this.handleDataChange);
    this.connect(this.props.to);
  },
  componentWillUnmount: function () {
    Store.off('CHANGED', this.handleDataChange);
    this.disconnect(this.props.to);
  },
  componentWillUpdate: function (nextProps) {   
    if (nextProps.name == this.props.name) return;
    this.disconnect(this.props.to);
  },
  componentDidUpdate: function (prevProps) {
    if (prevProps.name == this.props.name) return;
    this.connect(this.props.to);
  },
  handleNameChange: function (event) {
    Store.set(this.props.path.concat(['name']), event.target.value);
  },
  renderAttributes: function () {
    if (Object.keys(this.state.attributes).length == 0) return;
    var v = Store.get(this.props.path.concat(['element']));
    var args = this.props.args || {};
    for (var k in this.state.throughs) {
      args[k] = this.state.throughs[k];
    }
    return (
      <div>
	<div style={{display: 'none'}}>
	  {
	    React.createElement(v.tagName, {
	      to: this.state.node, scope: this.props.scope,
	      path: this.props.path.concat(['element']),
	      args: args,
	      ...v
	    })
	  }
	</div>
	{
	  Object.keys(this.state.attrsToPaths).map(function (name) {
	    return (
	      <Attribute key={name} name={name}
			 value={this.state.attributes[name]}
			 scope={this.props.scope}
			 to={this.state.throughs[name]}
			 onChange={this.props.onChange}
			 path={this.props.path.concat(['attributes', name])}
			 paths={this.state.attrsToPaths[name]} />
	      );
	  }.bind(this))
	}
      </div>
    );
  },

  render: function () {
    let name = Store.get(this.props.path.concat(['name']));
    return (
      <div className="node" key={name}>
	<select value={name} onChange={this.handleNameChange}>
	  {
	    Object.keys(Store.get(['variables'])).map(function (v) {
	      return <option value={v} key={v}>{v}</option>
	    })
	  }
	</select>
	{ this.renderAttributes() }
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
    var node = AP(parseFloat(this.props.value) || 0);
    return {
      node: node
    };
  },
  connect: function (to) {
    if (!to) return;
    let v = this.getValue();
    if (v.toString().startsWith('~')) {
      if (!this.props.args || !this.props.args[v]) return;
      this.props.args[v].connect(to);
      return;
    }
    this.state.node.connect(to);
  },
  disconnect: function () {
    this.state.node.disconnect();
    try {
      let v = this.getValue();
      if (v.toString().startsWith('~')) {
	if (!this.props.args || !this.props.args[v]) return;
	this.props.args[v].disconnect();
	return;
      }
    } catch (e) {}
  },
  handleDataChange: function (path, value) {
    if (!subpathOf(path, this.props.path)) return;

    var p = path.slice(this.props.path.length);

    if (p.length == 1 && p[0] == 'value') {
      this.state.node.value = parseFloat(value) || 0;
      this.forceUpdate();
    }
  },
  componentDidMount: function () {
    Store.on('CHANGED', this.handleDataChange);
    this.connect(this.props.to);
  },
  componentWillUnmount: function () {
    Store.off('CHANGED', this.handleDataChange);
    this.disconnect();
  },
  handleChange: function (event) {
    Store.set(this.props.path.concat(['value']), event.target.value);
    if (this.props.paths) {
      for (var i = 0; i < this.props.paths.length; i++) {
	Store.set(this.props.paths[i].concat(['value']), event.target.value);
      }
    }
  },
  getValue: function () {
    return Store.get(this.props.path.concat(['value']));
  },
  render: function () {
    return (<input value={this.getValue()} onChange={this.handleChange} />);
  }
});

var Sequence = React.createClass({
  componentDidMount: function () {
    Store.on('CHANGED', this.handleDataChange);
  },
  componentWillUnmount: function () {
    Store.off('CHANGED', this.handleDataChange);
  },
  handleDataChange: function (path, value) {
    if (!subpathOf(path, this.props.path)) return;
    let p = path.slice(this.props.path.length);
    if (p[0] == 'values' || p[0] == 'steps' || p[0] == 'ticks')
      this.forceUpdate();
  },
  handleValueChange: function (i) {
    return function (event) {
      Store.set(this.props.path.concat(['values', i]), event.target.value);
    }.bind(this)
  },
  handleClick: function (i, j) {
    return function () {
      Store.set(this.props.path.concat(['steps', j]), i);
    }.bind(this);
  },
  dupe: function () {
    let steps = Store.get(this.props.path.concat(['steps']));
    Store.set(this.props.path.concat(['steps']), steps.concat(steps));
  },
  halve: function () {
    let steps = Store.get(this.props.path.concat(['steps']));
    Store.set(this.props.path.concat(['steps', 'length']), Math.floor(steps.length / 2));
  },
  plus1: function () {
    let steps = Store.get(this.props.path.concat(['steps']));
    Store.set(this.props.path.concat(['steps']), steps.concat([0]));
  },
  minus1: function () {
    let steps = Store.get(this.props.path.concat(['steps']));
    Store.set(this.props.path.concat(['steps', 'length']), steps.length - 1);
  },
  times2: function () {
    let steps = Store.get(this.props.path.concat(['steps']));
    var newSteps = [];
    for (var i = 0; i < steps.length; i++) {
      newSteps.push(steps[i], steps[i]);
    }
    Store.set(this.props.path.concat(['steps']), newSteps);
  },
  div2: function () {
    let steps = Store.get(this.props.path.concat(['steps']));
    var newSteps = [];
    for (var i = 0; i < steps.length; i+=2) {
      newSteps.push(steps[i]);
    }
    Store.set(this.props.path.concat(['steps']), newSteps);
  },
  addValue: function () {
    Store.set(this.props.path.concat(['values']), this.props.values.concat([0]));
  },
  render: function () {
    let steps = Store.get(this.props.path.concat(['steps']));
    let values = Store.get(this.props.path.concat(['values']));
    var rows = {};
    for (var i = 0; i < values.length; i++) {
      var row = [];
      for (var j = 0; j < steps.length; j++) {
	row.push(<td key={j}
		     className={'step ' + (steps[j] == i ? 'on' : 'off') + (this.props.index == j ? ' highlight' : '')}
		     style={{width: (100 / steps.length) + '%' }}
		     onClick={this.handleClick(i, j)} />);
      }
      rows[values[i]] = row;
    }

    var valuesArray = [];
    for (var i = 0; i < values.length; i++) {
      valuesArray.push(
	<tr key={i}>
	  <td>
	    <input className="val" type="text" value={values[i]}
		   onChange={this.handleValueChange(i)} />
	  </td>
	  {rows[values[i]]}
	</tr>
      );
    }
    return (
      <div>
      <a href="#" onClick={this.dupe}>dupe</a>
      <a href="#" onClick={this.halve}>halve</a>
      <a href="#" onClick={this.times2}>*2</a>
      <a href="#" onClick={this.div2}>/2</a>
      <a href="#" onClick={this.plus1}>+1</a>
      <a href="#" onClick={this.minus1}>-1</a>
      <table style={{width: 200}}>
	<tbody>{valuesArray}</tbody>
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
  handleDataChange: function (path, value) {
    if (subpathOf(path, this.props.path)) {
      if (path.length == this.props.path.length) {
	this.forceUpdate();
      }
    }
  },
  componentDidMount: function () {
    Store.on('CHANGED', this.handleDataChange);
  },
  componentWillUnmount: function () {
    Store.off('CHANGED', this.handleDataChange);
  },
  handleDrop: function (event) {
    this.setState({
      dragOver: 0
    });
    
    if (!this.props.scope.state.dragging) return;

    Store.set(this.props.path, copy(Store.get(this.props.scope.state.dragging)));
    if (this.props.paths) {
      for (var i = 0; i < this.props.paths.length; i++) {
	var p = this.props.paths[i];
	Store.set(p, copy(this.props.scope.state.dragging));
      }
    }
    if (subpathOf(this.props.scope.state.dragging, ['variables']) ||
	this.props.scope.state.dragging.length > 2) {
	  Store.set(this.props.scope.state.dragging, { tagName: Value, value: 0 });
    } else {
      Store.delete(this.props.scope.state.dragging);
    }

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
  getValue: function () {
    return Store.get(this.props.path);
  },
  render: function () {
    let v = this.getValue();
    return (
      <div className={`attr ${this.state.dragOver ? 'dragOver' : ''}`}
	   onDrop={this.handleDrop} onDragEnter={this.handleDragEnter}
	   onDragExit={this.handleDragExit} onDragOver={this.handleDragOver}
	   onDragLeave={this.handleDragExit}>
	<div>{this.props.name}:</div>
	<Draggable path={this.props.path} scope={this.props.scope}>
	    {
	      React.createElement(v.tagName, {
		to: this.props.to, scope: this.props.scope, path: this.props.path,
		args: this.props.args, paths: this.props.paths, ...v
	      })
	    }
	</Draggable>
      </div>
    );
  }
});
    
var Attributes = React.createClass({
  renderAttribute: function (name) {
    return <Attribute key={name} name={name}
		      scope={this.props.scope} to={this.props.attributeMap[name]}
		      onChange={this.props.onChange}
		      path={this.props.path.concat(['attributes', name])}
		      args={this.props.args} />;
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
  handleDataChange: function (path, value) {
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

var Delay = React.createClass({
  getInitialState: function () {
    var delay = ctx.createDelay(4);
    delay.delayTime.value = 0;
    var feedback = ctx.createGain();
    feedback.gain.value = 0;
    
    delay.connect(feedback);
    feedback.connect(delay);
    
    return {
      delay: delay,
      feedback: feedback
    };
  },
  connect: function (to) {
    if (!to) return;
    this.state.delay.connect(to);
  },
  disconnect: function (to) {
    this.state.delay.disconnect(to);
  },
  componentDidMount: function () {
    this.connect(this.props.to);
  },
  componentWillUnmount: function () {
    this.disconnect(this.props.to);
  },
  render: function () {
    return (
      <div className="node">
	<Attributes attributeList={['source', 'delay', 'feedback']}
		    attributeMap={{
			source: this.state.delay,
			delay: this.state.delay.delayTime,
			feedback: this.state.feedback.gain
		      }}
		    scope={this.props.scope}
		    attributes={this.props.attributes}
		    args={this.props.args}
		    path={this.props.path} />
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
      attributes: this.props.attributes,
      type: this.props.type
    }
  },
  handleDataChange: function (path, value) {
    if (!subpathOf(path, this.props.path)) return;
    var p = path.slice(this.props.path.length);
    if (p.length == 1 && p[0] == 'type') {
      this.state.osc.type = value;
      this.setState({
	type: value
      });
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
    Store.off('CHANGED', this.handleDataChange);
  },
  handleTypeChange: function (event) {
    Store.set(this.props.path.concat(['type']), event.target.value);
  },
  componentDidMount: function () {
    this.connect(this.props.to);
    Store.on('CHANGED', this.handleDataChange);
  },
  render: function () {
    var types = ['sine', 'triangle', 'sawtooth', 'square'];
    return (
      <div className='node'>
	{this.props.name}
	<select onChange={this.handleTypeChange} value={this.state.type}>
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
		    attributes={this.props.attributes}
		    path={this.props.path}
		    args={this.props.args} />
      </div>
    );
  }
});

var Index = React.createClass({
  handleDataChange: function (path, value) {
    if (!subpathOf(path, this.props.path)) return;
    let p = path.slice(this.props.path.length);

    if (p[0] == 'max')
      this.setState({max: value});
  },
  getInitialState: function () {
    var node = ctx.createScriptProcessor(BS, 1, 1);
    node.onaudioprocess = function (event) {
      var lastTick = this.state.lastTick || 0;
      var out = this.state.out || 0;
      var frequency = event.inputBuffer.getChannelData(0);
      var output = event.outputBuffer.getChannelData(0);
      
      var samplesPerCycle = ctx.sampleRate * frequency[0];
      for (var i = 0; i < BS; i++) {
	output[i] = out;
	if (i >= lastTick + samplesPerCycle) {
	  lastTick = i;
	  out++;
	  if (out >= this.state.max) out -= this.state.max;
	}
      }
      this.state.lastTick = lastTick - BS;
      this.state.out = out;
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
    Store.on('CHANGED', this.handleDataChange);
    this.connect(this.props.to);
  },
  componentWillUnmount: function () {
    Store.off('CHANGED', this.handleDataChange);
    this.disconnect();
  },
  handleMaxChange: function (event) {
    Store.set(this.props.path.concat(['max']), event.target.value);
  },
  render: function () {
    return (
      <div className='node'>
	Index
	<input type="number" onChange={this.handleMaxChange}
	       value={Store.get(this.props.path.concat(['max']))} />
	<Attributes attributeList={['seconds']}
		    attributeMap={{
			seconds: this.state.node,
		      }}
		    scope={this.props.scope}
		    attributes={this.props.attributes}
		    args={this.props.args}
		    path={this.props.path} />
      </div>
    );
  }
});
  
var Array = React.createClass({
  getInitialState: function () {
    var node = ctx.createScriptProcessor(BS, 1, 1);
    let steps = this.get(['steps']);
    let values = this.get(['values']);
    let ticks = this.get(['ticks']);
    node.onaudioprocess = function (event) {
      var index = event.inputBuffer.getChannelData(0);
      var output = event.outputBuffer.getChannelData(0);

      for (var i = 0; i < BS; i++) {
	var idx = Math.floor(index[0] / this.state.ticks) % this.state.steps.length;
	output[i] = this.state.values[this.state.steps[idx]] || 0;
      }
      setTimeout(function () {
	if (idx != this.state.idx) {
	  this.setState({
	    idx: idx
	  });
	}
      }.bind(this), 0);
    }.bind(this);
    
    var gain = ctx.createGain();
    node.connect(gain);
    
    return {
      node: node,
      gain: gain,
      attributes: this.props.attributes,
      steps: steps,
      values: values,
      ticks: ticks
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
  handleDataChange: function (path, value) {
    if (!subpathOf(path, this.props.path)) return;

    let p = path.slice(this.props.path);

    if (p[0] == 'steps')
      this.state.steps = this.get('steps');
    else if (p[0] == 'values')
      this.state.steps = this.get('values');
    else if (p[0] == 'ticks')
      this.setState({ticks: this.get('ticks')});
  },
  componentDidMount: function () {
    Store.on('CHANGED', this.handleDataChange);
    this.connect(this.props.to);
  },
  componentWillUnmount: function () {
    Store.off('CHANGED', this.handleDataChange);
    this.disconnect();
  },
  handleValuesChange: function (vals) {
    Store.set(this.props.path.concat(['values']), vals);
  },
  handleTicksChange: function (event) {
    Store.set(this.props.path.concat(['ticks']), event.target.value);
  },
  get: function (p) {
    return Store.get(this.props.path.concat(p));
  },
  render: function () {
    return (
      <div className='node'>
	<input value={this.get(['ticks'])}
	       onChange={this.handleTicksChange} type="number" />
	<Sequence values={this.get(['values'])}
		  steps={this.get(['steps'])}
		  onChange={this.handleValuesChange} scope={this.props.scope}
		  path={this.props.path} index={this.state.idx} />
	<Attributes attributeList={['base', 'index']}
		    attributeMap={{
			base: this.state.gain.gain,
			index: this.state.node
		      }}
		    scope={this.props.scope}
		    attributes={this.props.attributes}
		    args={this.props.args}
		    path={this.props.path} />
      </div>
    );
  }
});

var Arithmetic = React.createClass({
  initNode: function () {
    let vars = this.state.vars;
    var node = ctx.createScriptProcessor(BS, vars.length, 1);
    var varMap = {};
    for (var i = 0; i < vars.length; i++) {
      varMap[vars[i]] = i;
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

    let merger = ctx.createChannelMerger(vars.length, 1);
    merger.connect(node);
    
    let throughs = {};
    for (var i = 0; i < this.state.vars.length; i++) {
      if (!throughs.hasOwnProperty(this.state.vars[i]))
	throughs[this.state.vars[i]] = ctx.createGain();
      throughs[this.state.vars[i]].connect(merger, 0, i);
    }

    this.state.throughs = throughs;

    this.state.node = node;
  },
  handleDataChange: function (path, value) {
    if (!subpathOf(path, this.props.path)) return;
    let p = path.slice(this.props.path.length);
    if (p.length == 1 && p[0] == 'expression') {
      try {
	this.state.expression = math.compile(value);
      } catch (e) {}
      this.forceUpdate();
    }
  },
  getInitialState: function () {
    var exp = math.compile(Store.get(this.props.path.concat(['expression'])));
    return {
      expression: exp,
      node: null,
      vars: ['x']
    };
  },
  handleExpressionChange: function (exp) {
    Store.set(this.props.path.concat(['expression']), exp);
  },
  connect: function (to) {
    if (!to) return;
    this.state.node.connect(to);
  },
  disconnect: function () {
    this.state.node.disconnect();
  },
  componentDidMount: function () {
    Store.on('CHANGED', this.handleDataChange);
    this.connect(this.props.to);
  },
  componentWillUnmount: function () {
    Store.off('CHANGED', this.handleDataChange);
    this.disconnect();
  },
  render: function () {
    if (!this.state.node) this.initNode();
    let attrs = Store.get(this.props.path.concat(['attributes']));
    console.log(attrs);
    return (
      <div className='node'>
	<Expression onChange={this.handleExpressionChange}
		    value={Store.get(this.props.path.concat(['expression']))} />
	<Attributes attributeList={Object.keys(attrs)}
		    attributeMap={this.state.throughs}
		    scope={this.props.scope}
		    attributes={attrs}
		    args={this.props.args}
		    path={this.props.path} />
      </div>
    );
  }
});

var Scope = React.createClass({
  getInitialState: function () {
    return {
      throughs: {},
      dragging: false,
      newVariableName: ''
    };
  },
  handleDataChange: function (path) {
    if (path.length <= 2) {
      this.forceUpdate();
    }
  },
  handleDataDelete: function (path) {
    if (subpathOf(path, ['destination'])) {
      this.forceUpdate();
    }
  },
  componentDidMount: function () {
    Store.on('CHANGED', this.handleDataChange);
    Store.on('DELETED', this.handleDataDelete);
  },
  componentWillUnmount: function () {
    Store.off('CHANGED', this.handleDataChange);
    Store.off('DELETED', this.handleDataDelete);
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
	  ticks: 1,
	  attributes: {
	    base: { tagName: Value, value: 110 },
	    index: {
	      tagName: Index,
	      max: 4,
	      attributes: {
		seconds: {
		  tagName: Value,
		  value: 1
		}
	      }
	    }
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
	  name: Object.keys(Store.get(['variables']))[0],
	  attributes: {}
	};
      if (thing == 'index')
	newNode = {
	  tagName: Index,
	  max: 4,
	  attributes: {
	    seconds: { tagName: Value, value: 1 }
	  }
	};
      if (thing == 'delay')
	newNode = {
	  tagName: Delay,
	  attributes: {
	    source: { tagName: Value, value: 0 },
	    delay: { tagName: Value, value: 1 },
	    feedback: { tagName: Value, value: 0 }
	  }
	};
      
      Store.set(['destination', Math.random()], newNode);
    }
  },
  _getAttributeMap: function (path, node) {
    if (typeof node !== 'object') return [];

    if (node.tagName === Value && node.value.toString().startsWith('~')) {
      return [{
	name: node.value,
	path: path
      }];
    }

    var ret = [];
    for (var k in node) {
      ret = ret.concat(this._getAttributeMap(path.concat([k]), node[k]));
    }
    return ret;
  },
  getAttributeMap: function (name) {
    let variables = Store.get(['variables']);
    if (!variables.hasOwnProperty(name)) return;
    
    var v = variables[name];

    var atp = this._getAttributeMap([], v);
    var attrsToPaths = {};
    for (var i = 0; i < atp.length; i++) {
      if (!attrsToPaths.hasOwnProperty(atp[i].name))
	attrsToPaths[atp[i].name] = [];
      attrsToPaths[atp[i].name].push(atp[i].path);
    }
    return attrsToPaths;
  },
  handleAddVariable: function () {
    Store.set(['variables', this.state.newVariableName], {tagName: Value, value: 0});
    this.setState({
      newVariableName: ''
    });
  },
  handleChange: function (path, value) {
    Store.set(path, value);
  },
  handleDelete: function (path) {
    Store.delete(path);
  },
  handleMove: function (from, to) {
    Store.move(from, to);
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
	    <a href="#" onClick={this.handleAddClick('index')}>index</a>
	    <a href="#" onClick={this.handleAddClick('delay')}>delay</a>
	  </div>
	</div>
	{this.renderVariables(Store.get(['variables']))}
	{this.renderDestination(Store.get(['destination']))}
      </div>
    );
  }
});

var Data = function (data) {
  var _data = data || {
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

  Object.defineProperty(this, 'data', {
    get: function () { return _data; }
  });

  var _eventTypes = {
    CHANGED: 'CHANGED',
    DELETED: 'DELETED'
  };
    
  var _listeners = {};
  for (var evt in _eventTypes) {
    _listeners[evt] = [];
  }
  
  this.on = function (eventType, callback) {
    _listeners[eventType].push(callback);
  };

  this.off = function (eventType, callback) {
    _listeners[eventType].splice(_listeners[eventType].indexOf(callback), 1);
  };

  this.emit = function (eventType, path, value) {
    for (var i = 0; i < _listeners[eventType].length; i++) {
      _listeners[eventType][i](path, value);
    }
  };

  var _set = function (original, path, value) {
    if (value === undefined || value === false || value === null) return _delete(path);
    if (path.length == 0) return value;
    original[path[0]] = _set(original[path[0]], path.slice(1), value);
    return original;
  };
  this.set = function (path, value) {
    _data = _set(_data, path, value);
    this.emit('CHANGED', path, value);
  };

  var _delete = function (original, path) {
    if (path.length == 0) return original;
    if (path.length == 1) {
      delete original[path[0]];
      return original;
    }
    original[path[0]] = _delete(original[path[0]], path.slice(1));
    return original;
  };
  this.delete = function (path) {
    this.emit('DELETED', path);
    _data = _delete(_data, path);
  };

  var _link = function (from, to) {
    this.set(to, this.get(from));
  };
  this.link = _link.bind(this);

  function _get(original, path) {
    if (path.length == 0) return original;
    return _get(original[path[0]], path.slice(1));
  };
  this.get = function (path) {
    return _get(_data, path);
  };
};

function copy(obj) {
  // return a deep copy of obj
  if (Object.prototype.toString.call(obj) === '[object Array]') {
    return obj.slice(0);
  }
  if (typeof obj !== 'object') return obj;
  var ret = {};
  for (var k in obj)
    ret[k] = copy(obj[k]);
  return ret;
};

function subpathOf(a, b) {
  // returns true if a is a subpath of b
  if (a.length == 0)
    return b.length == 0;
  if (b.length == 0) return true
  if (b[0] != a[0]) return false;
  return subpathOf(a.slice(1), b.slice(1));
};

var Store = new Data;

ReactDOM.render(
  <Scope name='test' />,
  document.getElementById('root')
);
