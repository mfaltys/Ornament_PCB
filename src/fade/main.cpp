#include <Arduino.h>
#include <avr/sleep.h>

// Same tree wiring as demo: 9 charlie-free GPIO LEDs + button on PA2 (Arduino 9).
const uint8_t ledPins[] = {8, 0, 1, 7, 6, 2, 3, 5, 4};
const uint8_t numLEDs = sizeof(ledPins) / sizeof(ledPins[0]);

const unsigned long animationMinutes = 5; // Time in minutes for animation to run
const unsigned long animationDuration = animationMinutes * 60000UL;

// --- Fade tuning (coin-cell friendly) ---
// Only ONE LED is ever on at a time, and brightness is capped so peak/average
// current stays low. Software PWM is used so it works on all 9 pins even
// though the ATtiny1614 only has 6 hardware PWM channels (TCA0 split mode).
const uint8_t fadeMax = 128;      // Brightness cap 0-255. 128 ~= half current, still bright.
const uint8_t fadeSteps = 64;     // Steps per ramp (up or down).
const uint8_t pwmSlices = 4;      // PWM slices per brightness step; more = smoother, more CPU.
const unsigned int slicePeriodUs = 1200; // One software-PWM slice period. ~833 Hz, flicker-free.

volatile bool buttonPressed = false;

ISR(PORTA_PORT_vect) {
  PORTA.INTFLAGS = PIN2_bm;
  buttonPressed = true;
}

void sleepNow() {
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  cli();
  sleep_enable();
  PORTA.INTFLAGS = PIN2_bm;
  sei();
  sleep_cpu();
  sleep_disable();
}

void setup() {
  PORTA.PIN3CTRL = PORT_PULLUPEN_bm;
  PORTA.PIN2CTRL = PORT_PULLUPEN_bm | PORT_ISC_FALLING_gc;

  for (uint8_t i = 0; i < numLEDs; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
}

void allLEDsOff() {
  for (uint8_t i = 0; i < numLEDs; i++) {
    digitalWrite(ledPins[i], LOW);
  }
}

bool checkButton() {
  if (buttonPressed) {
    buttonPressed = false;
    delay(50);
    if (digitalRead(9) == LOW) {
      while (digitalRead(9) == LOW);
      delay(50);
      return true;
    }
  }
  return false;
}

// Emit one software-PWM slice at the given brightness (0..255) on a single LED.
// Returns immediately for 0 (fully off) to save power.
inline void pwmSlice(uint8_t pin, uint8_t brightness) {
  if (brightness == 0) {
    digitalWrite(pin, LOW);
    delayMicroseconds(slicePeriodUs);
    return;
  }
  unsigned int onTime = (unsigned int)brightness * slicePeriodUs / 255;
  unsigned int offTime = slicePeriodUs - onTime;
  digitalWrite(pin, HIGH);
  if (onTime) delayMicroseconds(onTime);
  digitalWrite(pin, LOW);
  if (offTime) delayMicroseconds(offTime);
}

// Hold `brightness` for one fade step (a few PWM slices).
inline void pwmHold(uint8_t pin, uint8_t brightness) {
  for (uint8_t s = 0; s < pwmSlices; s++) {
    pwmSlice(pin, brightness);
  }
}

// Fade a single LED up then down. Returns false if the animation should stop
// (button pressed or timeout) so loop() can exit promptly.
bool breatheOne(uint8_t pin, bool &animating, unsigned long animStart) {
  // Ramp up 0 -> fadeMax.
  for (uint8_t step = 0; step <= fadeSteps && animating; step++) {
    uint8_t brightness = (uint16_t)step * fadeMax / fadeSteps;
    pwmHold(pin, brightness);
    if (checkButton()) { animating = false; allLEDsOff(); return false; }
    if (millis() - animStart >= animationDuration) { animating = false; allLEDsOff(); return false; }
  }
  // Ramp down fadeMax -> 0.
  for (int step = fadeSteps; step >= 0 && animating; step--) {
    uint8_t brightness = (uint16_t)step * fadeMax / fadeSteps;
    pwmHold(pin, brightness);
    if (checkButton()) { animating = false; allLEDsOff(); return false; }
    if (millis() - animStart >= animationDuration) { animating = false; allLEDsOff(); return false; }
  }
  digitalWrite(pin, LOW);
  return animating;
}

void loop() {
  static bool animating = false;
  static unsigned long animStart = 0;

  if (checkButton()) {
    if (animating) {
      animating = false;
      allLEDsOff();
    } else {
      animating = true;
      animStart = millis();
    }
  }

  if (animating) {
    if (millis() - animStart >= animationDuration) {
      animating = false;
      allLEDsOff();
    } else {
      // Breathing chase: each LED fades in and out in turn. Only one LED
      // is ever driven, keeping coin-cell peak current to a single LED.
      for (uint8_t i = 0; i < numLEDs && animating; i++) {
        if (!breatheOne(ledPins[i], animating, animStart)) break;
      }
    }
  } else {
    sleepNow();
  }
}
