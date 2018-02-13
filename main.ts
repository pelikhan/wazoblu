/**
 * 
 * The bus has 2x300w converter driven by 2 micro:bit + ElecFreak shield ( https://www.elecfreaks.com/estore/elecfreaks-micro-bit-breakout-board.html)
 * The converter are connected to multiple neopixel strips
 * 
 */

/*
* configuration
* we assume a POV from the charger looking towards the driver
* The elecfreak shield provides a set of pins with 5v levelling (8 through 16).
* Light strips: these are WS2812B neopixels
*/
const ceilingStrip = neopixel.create(DigitalPin.P8, 299, NeoPixelMode.RGB);
const wallStrip = neopixel.create(DigitalPin.P9, 298, NeoPixelMode.RGB);

/*
* The bus layout goes as follow: counter top, counter top + overhead AC, fireplace, seats
*/
const countertopStrip = wallStrip.range(0, 60);
const acStrip = wallStrip.range(60, 60);
const stoveStrip = wallStrip.range(120, 60);
const seatStrip = wallStrip.range(180, wallStrip.length() - 180);

/**
 * This is the state of the engine
 */
class Animation {
    strip: neopixel.Strip;
    n: number;
    constructor(strip: neopixel.Strip) {
        this.strip = strip;
        this.n = this.strip.length();
    }
    apply() {

    }
}

enum Mode {
    Off,
    Ambient,
    Party,
    Last
}

interface State {
    lastCommand: number;
    brightness: number;
    animations: Animation[];
    mode: Mode;
}

enum Strips {
    Seat,
    Stove,
    AC,
    CounterTop,
    Wall,
    Ceiling
}

const state: State = {
    lastCommand: input.runningTime(),
    brightness: 64,
    animations: [],
    mode: Mode.Off
}

/**
 * Animations
 */
class AmbientAnimation extends Animation {
    color: number;
    d: number;
    constructor(strip: neopixel.Strip, color: number) {
        super(strip);
        this.color = color;
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        const maxd = Math.max(r, Math.max(g, b)) - 4;
        this.d = 0;
        for (let i = 0; i < this.n; ++i) {
            const c = ((r - this.d) << 24) | ((g - this.d) << 8) | (b - this.d)
            this.d += Math.max(0, Math.min(maxd, Math.random(3) - 1));
            this.strip.setPixelColor(i, c);
        }
    }
    apply() {
        const r = (this.color >> 16) & 0xff;
        const g = (this.color >> 8) & 0xff;
        const b = this.color & 0xff;
        const maxd = Math.max(r, Math.max(g, b)) - 4;
        const c = ((r - this.d) << 24) | ((g - this.d) << 8) | (b - this.d)
        this.d += Math.max(0, Math.min(maxd, Math.random(3) - 1));
        this.strip.rotate();
        this.strip.setPixelColor(0, c);
    }
}

class PartyAnimation extends Animation {
    constructor(strip: neopixel.Strip) {
        super(strip)
    }

    apply() {

    }
}

function setMode(mode: Mode) {
    state.animations = [];
    switch (mode) {
        case Mode.Ambient:
            state.animations.push(new AmbientAnimation(ceilingStrip, neopixel.rgb(100, 100, 100)));
            state.animations.push(new AmbientAnimation(seatStrip, neopixel.rgb(64, 64, 64)));
            state.animations.push(new AmbientAnimation(stoveStrip, neopixel.rgb(32, 32, 32)));
            state.animations.push(new AmbientAnimation(acStrip, neopixel.rgb(32, 32, 32)));
            state.animations.push(new AmbientAnimation(countertopStrip, neopixel.rgb(32, 32, 32)));
            break;
        case Mode.Party:
            state.animations.push(new PartyAnimation(ceilingStrip));
            state.animations.push(new PartyAnimation(wallStrip));
            break;
    }
}

/**
 * Radio messages
 */
enum Message {
    Brightness,
    Mode
}

radio.setGroup(255);
radio.setTransmitPower(3);

function sendState(msg: Message, value: number) {
    const st = value << 8 | msg;
    radio.sendNumber(st);
}
radio.onDataPacketReceived(({ receivedNumber }) => {
    const msg = <Message>receivedNumber & 0xff;
    const value = (receivedNumber >> 8) & 0xff;
    switch (msg) {
        case Message.Brightness:
            state.brightness = value;
            break;
        case Message.Mode:
            setMode(value);
            break;
    }
})

/*
* Buttons
* There is a 3 arcade button on the side of a door (http://www.slagcoin.com/joystick/layout.html)
*/
// brightness control
input.onButtonPressed(Button.A, function () {
    state.lastCommand = input.runningTime();
    state.brightness = (state.brightness + 8) % 0xff;
    sendState(Message.Brightness, state.brightness);
});
input.onButtonPressed(Button.B, function () {
    state.lastCommand = input.runningTime();
    state.brightness = (state.brightness + 8) % 0xff;
    sendState(Message.Brightness, state.brightness);
});
// switch mode
input.onButtonPressed(Button.AB, function () {
    state.lastCommand = input.runningTime();
    state.mode = (state.mode + 1) % Mode.Last;
    sendState(Message.Mode, state.mode);
})

/**
 * Animation loop
 */
control.inBackground(function () {
    // random animation
    led.toggle(Math.random(3), Math.random(3));

    // apply brightness
    ceilingStrip.setBrightness(state.brightness);
    wallStrip.setBrightness(state.brightness);

    // render current state
    for (let i = 0; i < state.animations.length; ++i) {
        state.animations[i].apply();
    }
    ceilingStrip.show();
    wallStrip.show();

    // wait a tiny bit
    basic.pause(5);
})