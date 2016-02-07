var ctx = new AudioContext();

var Var = React.createClass({
    render: function () {
	return (
	    <span className="var">
	    {this.props.link}
	    </span>
	);
    }
});

var Attr = React.createClass({
    render: function () {
	return (
		<div className="attr">
		{this.props.name}: { React.cloneElement(React.Children.only(this.props.children), {
		    ref: function (v) {
			v.connect(this.props.to);
		    }.bind(this)
		})
		}
		</div>
	);
    }
});

var Value = React.createClass({
    connect: function (to) {
	to.value = this.props.val;
    },
    render: function () {
	return (<span>{this.props.val}</span>);
    }
});

/*
var Osc = React.createClass({
    getInitialState: function () {
	return {
	    osc: ctx.createOscillator()
	};
    },
    componentDidMount: function () {
	var freq = this.props.attrs.freq;
//	this.state.osc.connect(ctx.destination);
	this.state.osc.start();
    },
    render: function () {
	var attrs = [];
	for (var k in this.props.attrs) {
	    attrs.push(<Attr name={k} link={this.props.attrs[k]} key={k} ref={function (attr) {
		//console.log(this, attr.props.link);
		var target = null;
		if (k == 'freq')
		    target = this.state.osc.frequency;

		if (target == null) return;

		console.log(attr.props.link);
		if (typeof attr.props.link == 'object') {
		    attr.props.link.state.osc.connect(target);
		} else {
		    target.value = attr.props.link;
		}
	    }.bind(this)}/>);
	}
	return (
	    <div className="node">
	    {this.props.name}
	    {attrs}
	    </div>
	);
    }
});
*/

var Osc = React.createClass({
    getInitialState: function () {
	return {
	    osc: ctx.createOscillator()
	}
    },
    connect: function (to) {
	this.state.osc.connect(to);
    },
    start: function () {
	this.state.osc.start();
    },
    render: function () {
	return (<div className='node'> {this.props.name}
		{ React.Children.map(this.props.children, function (c) {
		    var to = null;
		    if (c.props.name == 'frequency') {
			to = this.state.osc.frequency;
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
    componentDidMount: function () {
	// React.Children.forEach(this.props.children, function (c) {
	//     console.log(c);
	//     c.state.osc.connect(ctx.destination);
	// });
    },
    render: function () {
	return (<div>
		{ React.Children.map(this.props.children, function (c) {
		    return React.cloneElement(c, {
			ref: function (ch) {
			    ch.connect(ctx.destination);
			    ch.start();
			}.bind(this)
		    });
		}, this)
		}
		</div>
	       );
    }
});

/*
ReactDOM.render(
	<Dest>
	<Osc name="fm'ed">
	<Attr name='frequency'>
	<Osc name='sin'>
	<Attr name='frequency'>
	<Value val={10}></Value>
	</Attr>
	</Osc>
	</Attr>
	</Osc>
	</Dest>,
    document.getElementById('root')
);
*/
