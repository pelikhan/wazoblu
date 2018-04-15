radio.setGroup(1);
radio.setTransmitPower(7);

pins.setPull(DigitalPin.P1, PinPullMode.PullDown)
basic.forever(() => {
    let voltage = pins.analogReadPin(AnalogPin.P1);
    voltage = voltage * 16;

    radio.sendNumber(voltage);
    basic.showString(voltage / 1000 + "." + voltage % 1000);
})
