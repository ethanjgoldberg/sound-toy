var ctx = new AudioContext();

var BUFFSIZE = 16384;
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
    audioParam.connect = function (destination, input) {
	gainNode.connect(destination);
    }
    audioParam._nodes = [scriptNode, gainNode];
    return audioParam;
}

var Attr = React.createClass({
    render: function () {
	return (
		<div className="attr">
		{this.props.name}:
	    { React.cloneElement(React.Children.only(this.props.children), {
		to: this.props.to
	    })
	    }
	    </div>
	);
    }
});

var Value = React.createClass({
    getInitialState: function () {
	return {
	    value: this.props.val
	};
    },
    connect: function (to) {
	console.log(this.props.to);
	to.value = this.state.value;
    },
    handleChange: function (event) {
	this.setState({
	    value: event.target.value
	});
    },
    render: function () {
	this.connect(this.props.to);
	return (<input type="number" value={this.state.value} onChange={this.handleChange} />);
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
			to: to
		    });
		}.bind(this))
		}
		</div>
	       );
    }
});

var Dest = React.createClass({
    render: function () {

	/*
	var osc1 = ctx.createOscillator();
	var osc2 = ctx.createOscillator();
	var gain = ctx.createGain();
	var proc = AP(ctx, 1000);
	
	osc2.frequency.value = 0;
	
	osc1.frequency.value = .25;
	osc1.connect(gain);
	osc1.start();
	gain.gain.value = 1000;

	gain.connect(proc);

	proc.connect(osc2.frequency);
	
	osc2.connect(ctx.destination);
	osc2.start();
	return (<div></div>);
*/
	
	return (<div>
		{ React.Children.map(this.props.children, function (c) {
		    return React.cloneElement(c, {
			to: ctx.destination
		    });
		}) }
		</div>
	       );
	/*
			ref: function (ch) {
			    ch.connect(ctx.destination);
			}.bind(this)
		    });
		}, this)
		}
		</div>
	       );
*/
    }
});

ReactDOM.render(
	<Dest>
	<Osc name="fm'ed">
	<Attr name='frequency'>

    
	<Osc name='sin'>
	
	<Attr name='frequency'>
	<Value val={.25}></Value>
	</Attr>
	
	<Attr name='gain'>
	<Value val={220}></Value>
	</Attr>

	<Attr name='offset'>
	<Value val={220}></Value>
	</Attr>
	
	</Osc>

    
    </Attr>

	<Attr name='gain'>
	<Value val={1}></Value>
	</Attr>

	<Attr name='offset'>
	<Value val={0}></Value>
	</Attr>
	</Osc>
	</Dest>,
    document.getElementById('root')
);
