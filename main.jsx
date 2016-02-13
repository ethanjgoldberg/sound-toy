var ctx = new AudioContext();

var BS = 256;

var ONES = ctx.createScriptProcessor(BS, 0, 1);
var outputBuffer = new Float32Array(BS);
for (var i = 0; i < BS; i++) outputBuffer[i] = 1;
ONES.onaudioprocess = function (event) {
  event.outputBuffer.getChannelData(0).set(outputBuffer);
}

var AP = function (defaultValue) {
  var gainNode = ctx.createGain(),
      audioParam;

  ONES.connect(gainNode);

  audioParam = gainNode.gain;
  audioParam.value = defaultValue;
  audioParam.connect = function (destination) {
    gainNode.connect(destination, 0);
  }
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
    if (this.props.onChange) {
      this.props.onChange(math.compile(event.target.value));
    }
    this.setState({
      value: event.target.value
    });
  },
  render: function () {
    return (<input type="text" value={this.state.value} onChange={this.handleChange} />);
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
  handleChange: function (event) {
    this.state.node.value = event.target.value;
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
  getInitialState: function () {
    return {
      values: this.props.values.join(', ')
    };
  },
  handleChange: function (event) {
    if (this.props.onChange) {
      this.props.onChange(event.target.value.split(/[ ,]+/).map(function (s) { return parseFloat(s) || 0; }));
    }
    
    this.setState({
      values: event.target.value
    });
  },
  render: function () {
    return (<input type="text" value={this.state.values} onChange={this.handleChange} />);
  }
});

var Attributes = React.createClass({
  renderAttribute: function (name) {
    return (
      <div className='attr' key={name}>
	{name}
	{
	  React.cloneElement(this.props.attributes[name], {
	    to: this.props.attributeMap[name], scope: this.props.scope
	  })
	}
      </div>
    );
  },
  render: function () {
    return <div>{this.props.attributeList.map(this.renderAttribute)}</div>;
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
      offset: offset
    }
  },
  connect: function (to) {
    if (!to) return;
    this.state.offset.connect(to);
  },
  handleTypeChange: function (event) {
    this.state.osc.type = event.target.value;
  },
  componentDidMount: function () {
    this.connect(this.props.to);
  },
  render: function () {
    var types = ['sine', 'triangle', 'sawtooth', 'square'];
    return (
      <div className='node'> {this.props.name}
	<select onChange={this.handleTypeChange}>
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
		    attributes={this.props.attributes} />
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
	  if (this.state.vals.length == 0) idx = 0;
	  else idx = idx % this.state.vals.length;
	}
	output[i] = this.state.vals[idx] || 0
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
      vals: this.props.values,
      node: node,
      gain: gain,
      frequency: frequency
    }
  },
  connect: function (to) {
    if (!to) return;
    this.state.gain.connect(to);
  },
  handleValuesChange: function (vals) {
    this.setState({
      vals: vals
    });
  },
  componentDidMount: function () {
    this.connect(this.props.to);
  },    
  render: function () {
    return (
      <div className="node">
	<List values={this.props.values} onChange={this.handleValuesChange} />
	<Attributes attributeList={['base', 'frequency']}
		    attributeMap={{
			base: this.state.gain.gain,
			frequency: this.state.frequency
		      }}
		    scope={this.props.scope}
		    attributes={this.props.attributes} />
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
  connect: function (to) {
    if (!to) return;
    this.state.node.connect(to);
  },
  render: function () {
    if (this.state.node == null)
      this.state.node = this.initNode();

    this.connect(this.props.to);
    return (
      <div className="node">
	<Expression onChange={this.handleExpressionChange} value={this.props.expression} />
	<Attributes attributeList={Object.keys(this.props.variables)}
		    attributeMap={this.state.throughs}
		    scope={this.props.scope}
		    attributes={this.props.variables} />
      </div>
    );
  }
});

var Scope = React.createClass({
  getInitialState: function () {
    return {
      throughs: {}
    };
  },
  handleAddClick: function (thing) {
    return function () {
      if (thing == 'oscillator')
	newNode = <Osc />;
      this.props.children.push(newNode);
      //ReactDOM.render(this.props.children(<Osc />), node);
    }.bind(this);
  },
  renderVariables: function (vars) {
    var ret = [];
    for (var k in vars) {
      ret.push(<SetVariable key={k} name={k} value={vars[k]} scope={this} />);
    }
    return ret;
  },
  renderDestination: function (dest) {
    var ret = [];
    for (var k in dest) {
      ret.push(React.cloneElement(dest[k], {
	key: k,
	to: ctx.destination,
	scope: this
      }));
    }
    return ret;
  },
  render: function () {
    return (
      <div>
	<div>Add: <a href="#" onClick={this.handleAddClick('oscillator')}>oscillator</a></div>
	{this.renderVariables(this.props.variables)}
	{this.renderDestination(this.props.destination)}
      </div>
    );
  }
});

var blue2 = (
  <Scope name='blue'
	 variables={{
	     blue: (
	       <Array values={[1,1,1,1,1.33,1.33,1,1, 1.5, 1.33, 1, 1]}
		      attributes={{
			  base: <Value value={110} />,
			  frequency: <Arithmetic expression='x / 4' variables={{x: <Variable name='speed' />}} />
			}} />
	     ),
	     speed: <Value value={1} />,
	     gain: <Value value={0} />
	   }}
	 destination={{
	     "fm'ed": (
	       <Osc attributes={{
		   frequency: (
		     <Array values={[1,2,1.5,1.2,1,2,1.6,1.5]}
			    attributes={{
				base: <Variable name='blue' />,
				frequency: <Arithmetic expression='2 * x' variables={{x: <Variable name='speed' />}} />
			      }} />
		   ),
		   gain: <Variable name='gain' />,
		   offset: <Value value={0} />
		 }} />
	     ),
	     'melody': (
	       <Osc attributes={{
		   frequency: (
		     <Array values={[4,3,2.6,3.2,3,2,1,3,2.6,3.2,3,2]}
			    attributes={{
				frequency: <Arithmetic expression='6 * x' variables={{x: <Variable name='speed' />}} />,
				base: <Variable name='blue' />
			      }} />
		   ),
		   gain: <Variable name='gain' />,
		   offset: <Value value={0} />
		 }} />
	     )
	   }} />
);

var tester = (
  <Scope name='test'
	 variables={{
	     frequency: <Value value={110} />
	   }}
	 destination={{
	     t: (
	       <Osc attributes={{
		   frequency: (
		     <Array values={[1.6, 1.5, 1, 1, 1.6, 1.5, 1, 1, 1.6, 1.5, 2, 1.5, 1.6, 1.5, 1, 1]}
			    attributes={{
				frequency: <Value value={1} />,
				base: <Value value={110} />
			      }}
		     />
		   ),
		   gain: <Value value={1} />,
		   offset: <Value value={0} />
		 }} />
	     )
	   }} />
);

ReactDOM.render(
  tester,
  document.getElementById('root')
);
