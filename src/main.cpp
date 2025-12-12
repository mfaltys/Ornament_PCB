#include <Arduino.h>
#include <avr/sleep.h>

const uint8_t ledPins[] = {8, 0, 1, 7, 6, 2, 3, 5, 4};

ISR(PORTA_PORT_vect) {
  // Clear PA2 interrupt flag
  PORTA.INTFLAGS = PIN2_bm;
}

void sleepNow() {
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  cli();
  sleep_enable();
  // Clear any pending interrupt flag before sleeping
  PORTA.INTFLAGS = PIN2_bm;
  sei();
  sleep_cpu();
  sleep_disable();
}

void setup() {
  // Set unused pin PA3 (pin 10) to INPUT_PULLUP
  PORTA.PIN3CTRL = PORT_PULLUPEN_bm;

  // Configure button pin PA2 (pin 9) for pullup and falling edge interrupt
  // PA2 is asynchronous and can wake from PWR_DOWN with FALLING
  PORTA.PIN2CTRL = PORT_PULLUPEN_bm | PORT_ISC_FALLING_gc;

  for (uint8_t i = 0; i < sizeof(ledPins)/sizeof(ledPins[0]); i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
}

void setLEDs(bool on) {
  for (uint8_t i = 0; i < sizeof(ledPins)/sizeof(ledPins[0]); i++) {
    digitalWrite(ledPins[i], on ? HIGH : LOW);
  }
}

void loop() {
  static bool ledsOn = false;
  static unsigned long timerStart = 0;

  if (digitalRead(9) == LOW) {
    delay(50); // debounce
    if (digitalRead(9) == LOW) {
      if (ledsOn) {
        // toggle off
        ledsOn = false;
        setLEDs(false);
      } else {
        // turn on
        ledsOn = true;
        timerStart = millis();
        setLEDs(true);
      }
      // wait for button release
      while (digitalRead(9) == LOW);
      delay(50); // additional debounce
    }
  }

  if (ledsOn && millis() - timerStart >= 120000) {
    ledsOn = false;
    setLEDs(false);
  }

  // If LEDs are off, go to sleep
  if (!ledsOn) {
    sleepNow();
  }
}