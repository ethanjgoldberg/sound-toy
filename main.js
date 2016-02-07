var ctx = new AudioContext();

var BUFFSIZE = 256;
var AP = function (context, defaultValue) {
    var scriptNode = context.createScriptProcessor(BUFFSIZE, 0, 1),
	gainNode = context.createGain(),
	outputBuffer = new Float32Array(BUFFSIZE),
	audioParam;
    for (var i = 0; i < BUFFSIZE; i++) outputBuffer[i] = 1;

    scriptNode.onaudioprocess = function (event) {
	event.outputBuffer.getChannelData(0).set(outputBuffer);
    }
    scriptNode.connect(gainNode);

    audioParam = gainNode.gain;
    audioParam.value = defaultValue;
    audioParam.connect = function (destination) {
	gainNode.connect(destination, 0);
    }
    audioParam._nodes = [scriptNode, gainNode];
    return audioParam;
}

var variables = {};

var SetVar = React.createClass({
    render: function () {
	if (!this.props.scope.state.throughs.hasOwnProperty(this.props.name))
	    this.props.scope.state.throughs[this.props.name] = ctx.createGain();
	return (
		<div className="node">
		<span className='var'>{this.props.name}</span>:
	    { React.cloneElement(React.Children.only(this.props.children),
				 { to: this.props.scope.state.throughs[this.props.name] })
	    }
	    </div>
	);
    }
});

var GetVar = React.createClass({
    connect: function (to) {
	if (!to) return;
	if (!this.props.scope.state.throughs.hasOwnProperty(this.props.name))
	    this.props.scope.state.throughs[this.props.name] = ctx.createGain();
	this.props.scope.state.throughs[this.props.name].connect(to);
    },
    render: function () {
	this.connect(this.props.to);
	return <span className='var'>{ this.props.name }</span>
    }
});

var Attr = React.createClass({
    render: function () {
	return (
		<div className="attr">
		{this.props.name}:
	    { React.cloneElement(React.Children.only(this.props.children), {
		to: this.props.to,
		scope: this.props.scope
	    })
	    }
	    </div>
	);
    }
});

var Value = React.createClass({
    getInitialState: function () {
	var node = AP(ctx, this.props.val);
	return {
	    value: this.props.val,
	    node: node
	};
    },
    connect: function (to) {
	if (!to) return;
	this.state.node.connect(to);
	//to.value = this.state.value;
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
	    value: this.props.val
	};
    },
    connect: function (to) {
	if (!to) return;
	to.value = this.state.value;
    },
    handleChange: function (event) {
	this.setState({
	    value: event.target.value.split(/[ ,]+/)
	});
    },
    render: function () {
	this.connect(this.props.to);
	return (<input type="text" value={this.state.value} onChange={this.handleChange} />);
    }
});

var Osc = React.createClass({
    getInitialState: function () {
	var osc = ctx.createOscillator();
	var gain = ctx.createGain();
	var offset = AP(ctx, 0);
	
	gain.gain.value = 0;

	osc.connect(gain);
	osc.frequency.value = 0;
	osc.start();

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
    render: function () {
	this.connect(this.props.to);
	return (<div className='node'> {this.props.name}
		{ React.Children.map(this.props.children, function (c) {
		    var to = null;
		    if (c.props.name == 'frequency') {
			to = this.state.osc.frequency;
		    } else if (c.props.name == 'gain') {
			to = this.state.gain.gain;
		    } else if (c.props.name == 'offset') {
			to = this.state.offset;
		    }
		    
		    if (to == null) return c;
		    return React.cloneElement(c, {
			to: to,
			scope: this.props.scope
		    });
		}.bind(this))
		}
		</div>
	       );
    }
});

var Array = React.createClass({
    getInitialState: function () {
	var BS = 4096 * 4;
	var node = ctx.createScriptProcessor(BS, 1, 1);
	node.onaudioprocess = function (event) {
	    var idx = this.state.idx || 0;
	    var lastChange = this.state.lastChange || 0;
	    var frequency = event.inputBuffer.getChannelData(0);
	    //var base = event.inputBuffer.getChannelData(1);
	    var output = event.outputBuffer.getChannelData(0)

	    for (var i = 0; i < BS; i++) {
		var samplesPerCycle = ctx.sampleRate / frequency[i];
		if (i >= lastChange + samplesPerCycle) {
		    lastChange = i;
		    idx++;
		    while (idx >= this.state.vals.value.length) {
			idx -= this.state.vals.value.length;
		    }
		}
		output[i] = this.state.vals.value[idx]// * base[i];
	    }
	    this.state.idx = idx;
	    this.state.lastChange = lastChange;
	    
	    this.state.lastChange -= BS;
	}.bind(this);
	
	var gain = ctx.createGain();
	node.connect(gain);
	
	var frequency = AP(ctx, 0);
	frequency.connect(node);
	
	return {
	    vals: { value: [] },
	    node: node,
	    gain: gain,
	    frequency: frequency
	}
    },
    connect: function (to) {
	if (!to) return;
	this.state.gain.connect(to);
    },
    render: function () {
	this.connect(this.props.to);

	return (<div className="node">
		{ React.Children.map(this.props.children, function (c) {
		    var to = null;
		    if (c.props.name == 'vals') {
			to = this.state.vals;
		    } else if (c.props.name == 'base') {
			to = this.state.gain.gain;
		    } else if (c.props.name == 'frequency') {
			to = this.state.frequency;
		    }
		    if (to == null) return c;
		    return React.cloneElement(c, {
			to: to,
			scope: this.props.scope
		    });
		}.bind(this))
		}
		</div>);
    }
});

var Dest = React.createClass({
    render: function () {
	return (<div>
		{ React.Children.map(this.props.children, function (c) {
		    return React.cloneElement(c, {
			to: ctx.destination,
			scope: this.props.scope
		    });
		}.bind(this)) }
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
    render: function () {
	return (<div>{
	React.Children.map(this.props.children, function (c) {
	    return React.cloneElement(c, { scope: this });
	}.bind(this))
	}</div>);
    }
});
ReactDOM.render(
	<Scope>
	<SetVar name='blue'>
	<Array>
	<Attr name='vals'><List val={[1,1,1,1,1.33,1.33,1,1, 1.5, 1.33, 1, 1]} /></Attr>
	<Attr name='base'><Value val={110} /></Attr>
	<Attr name='frequency'><Value val={.25} /></Attr>
	</Array>
	</SetVar>

	<SetVar name='speed'>
	<Value val={1} />
	</SetVar>

	<SetVar name='gain'>
	<Value val={1} />
	</SetVar>
	
	<Dest>
	<Osc name="fm'ed">
	
	<Attr name='frequency'>
	<Array name='mel'>
	<Attr name='vals'><List val={[1, 2, 1.8, 1.5]} /></Attr>
	<Attr name='base'>
	<GetVar name='blue' />
	</Attr>
	<Attr name='frequency'><Value val={1} /></Attr>
	</Array>
	</Attr>

	<Attr name='gain'><GetVar name='gain' /></Attr>

	<Attr name='offset'>
	<Value val={0}></Value>
	</Attr>
	</Osc>

	<Osc>
	<Attr name='frequency'>
	<Array>
	<Attr name='frequency'><Value val={3} /></Attr>
	<Attr name='vals'><List val={[0.5,0,0, 1,1.8,1, 0.5,0,0, 1.125,0,1.125]} /></Attr>
	<Attr name='base'><GetVar name='blue' /></Attr>
	</Array>
	</Attr>
	<Attr name='gain'><GetVar name='gain' /></Attr>
	</Osc>
    
    </Dest>
	</Scope>,
    document.getElementById('root')
);
