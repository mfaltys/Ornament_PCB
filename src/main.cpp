#include <Arduino.h>
#include <avr/sleep.h>

const uint8_t ledPins[] = {8, 0, 1, 7, 6, 2, 3, 5, 4};
const uint8_t zigzagLine[] = {2, 6, 0, 4, 8, 5, 1, 7, 3};
const unsigned int stepDelay = 74;
const uint8_t tailLength = 3;
const unsigned long animationMinutes = 5; // Time in minutes for animation to run
const unsigned long animationDuration = animationMinutes * 60000;

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

  for (uint8_t i = 0; i < sizeof(ledPins)/sizeof(ledPins[0]); i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
}

void allLEDsOff() {
  for (uint8_t i = 0; i < sizeof(ledPins)/sizeof(ledPins[0]); i++) {
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
      // Animation 1: Zigzag snake
      int numLEDs = sizeof(zigzagLine)/sizeof(zigzagLine[0]);
      for (int i = 0; i < numLEDs + tailLength && animating; i++) {
        if (i < numLEDs) digitalWrite(zigzagLine[i], HIGH);
        if (i >= tailLength) digitalWrite(zigzagLine[i - tailLength], LOW);
        delay(stepDelay);
        if (checkButton()) { animating = false; allLEDsOff(); break; }
        if (millis() - animStart >= animationDuration) { animating = false; allLEDsOff(); break; }
      }
      
      for (int i = numLEDs - 1 + tailLength; i >= 0 && animating; i--) {
        if (i < numLEDs) digitalWrite(zigzagLine[i], HIGH);
        if (i >= tailLength) digitalWrite(zigzagLine[i - tailLength], LOW);
        delay(stepDelay);
        if (checkButton()) { animating = false; allLEDsOff(); break; }
        if (millis() - animStart >= animationDuration) { animating = false; allLEDsOff(); break; }
      }

      // Animation 2: Sequential sweep
      for (uint8_t i = 0; i < sizeof(ledPins)/sizeof(ledPins[0]) && animating; i++) {
        digitalWrite(ledPins[i], HIGH);
        delay(stepDelay);
        if (checkButton()) { animating = false; allLEDsOff(); break; }
        if (millis() - animStart >= animationDuration) { animating = false; allLEDsOff(); break; }
        digitalWrite(ledPins[i], LOW);
      }
      
      for (int i = sizeof(ledPins)/sizeof(ledPins[0]) - 1; i >= 0 && animating; i--) {
        digitalWrite(ledPins[i], HIGH);
        delay(stepDelay);
        if (checkButton()) { animating = false; allLEDsOff(); break; }
        if (millis() - animStart >= animationDuration) { animating = false; allLEDsOff(); break; }
        digitalWrite(ledPins[i], LOW);
      }

      // Animation 3: Random sparkle
      for (uint8_t j = 0; j < 20 && animating; j++) {
        uint8_t randLED = random(0, sizeof(ledPins)/sizeof(ledPins[0]));
        digitalWrite(ledPins[randLED], HIGH);
        delay(stepDelay);
        if (checkButton()) { animating = false; allLEDsOff(); break; }
        if (millis() - animStart >= animationDuration) { animating = false; allLEDsOff(); break; }
        digitalWrite(ledPins[randLED], LOW);
      }
    }
  } else {
    sleepNow();
  }
}