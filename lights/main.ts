// wazoblu color controller
radio.setGroup(1);
radio.setTransmitPower(2);
radio.setTransmitSerialNumber(true);

let brightness = 64;
let colorMode = false;
let heartBeat = input.runningTime();
let voltage = 14000; // assume 100% charged
const ASLEEP = 10 * 6000; // 10 minutes

basic.showIcon(IconNames.Heart)

function render() {
    const v = pins.map(brightness, 0, 0xff, 0, 1023);
    if (!brightness) {
        // off
        pins.digitalWritePin(DigitalPin.P1, 0)
        pins.digitalWritePin(DigitalPin.P2, 0)
        pins.digitalWritePin(DigitalPin.P8, 0)
        pins.digitalWritePin(DigitalPin.P0, 0)
    } else if (!colorMode) {
        // white only
        pins.digitalWritePin(DigitalPin.P1, 0)
        pins.digitalWritePin(DigitalPin.P2, 0)
        pins.digitalWritePin(DigitalPin.P8, 0)
        pins.analogWritePin(AnalogPin.P0, v)
        pins.analogSetPeriod(AnalogPin.P0, 1000)
    } else {
        // color animation, districtube
        const n = 64;
        const t = (input.runningTime() / 1000) % 64;
        const r = v - t * 16;
        const g = t * 16;
        const b = v - r - g;
        pins.analogWritePin(AnalogPin.P1, r)
        pins.analogSetPeriod(AnalogPin.P1, 1000)
        pins.analogWritePin(AnalogPin.P2, g)
        pins.analogSetPeriod(AnalogPin.P2, 1000)
        pins.analogWritePin(AnalogPin.P8, b)
        pins.analogSetPeriod(AnalogPin.P8, 1000)
        pins.digitalWritePin(DigitalPin.P0, 0)
    }
}

basic.forever(() => {
    render();
})

// A - dimmer
input.onButtonPressed(Button.A, () => {
    brightness = Math.max(0, brightness - 64);
    broadcast();
})
control.onEvent(DAL.MICROBIT_ID_BUTTON_A, DAL.MICROBIT_BUTTON_EVT_HOLD, () => {
    brightness = 0;
    broadcast();
})

// B - brighter
input.onButtonPressed(Button.B, () => {
    brightness = Math.min(0xff, brightness + 64);
    broadcast();
})
control.onEvent(DAL.MICROBIT_ID_BUTTON_B, DAL.MICROBIT_BUTTON_EVT_HOLD, () => {
    brightness = 0xff;
    broadcast();
})

// AB - switch mode
input.onButtonPressed(Button.AB, () => {
    colorMode = !colorMode;
    broadcast();
})
// AB hold - off
control.onEvent(DAL.MICROBIT_ID_BUTTON_AB, DAL.MICROBIT_BUTTON_EVT_HOLD, () => {
    brightness = 0;
    broadcast();
})

// background loop to track if dead
basic.forever(() => {
    // check if dead
    if (heartBeat - input.runningTime() > ASLEEP) {
        brightness = 0;
        broadcast();
    }
    basic.pause(1000)
})

enum Message {
    Light = 1,
    Awake = 3,
    Voltage = 4
}

function broadcast(msg: Message = Message.Light) {
    heartBeat = input.runningTime();
    const buf = pins.createBuffer(3);
    buf.setNumber(NumberFormat.UInt8LE, 0, msg);
    buf.setNumber(NumberFormat.UInt8LE, 1, brightness)
    buf.setNumber(NumberFormat.UInt8LE, 2, colorMode ? 1 : 0);
    radio.sendBuffer(buf);
}

// a simple radio proxy
radio.onDataPacketReceived(({ receivedBuffer }) => {
    if (!receivedBuffer) return;
    const msg = receivedBuffer.getNumber(NumberFormat.UInt8LE, 0);
    switch (msg) {
        case Message.Light:
            brightness = receivedBuffer.getNumber(NumberFormat.UInt8LE, 1)
            colorMode = !!receivedBuffer.getNumber(NumberFormat.UInt8LE, 2);
            render();
            break;
        case Message.Awake:
            broadcast(Message.Light);
            break;
        case Message.Voltage:
            voltage = receivedBuffer.getNumber(NumberFormat.Int32LE, 1);
            break;
    }
})

broadcast(Message.Awake);