Feature: Eine Deutsche Spezifikation

  # Kommentar
  Scenario: Übersetzung der Schlüsselworte
    Given die Spezifikation ist in Deutsch geschrieben
    When die Spezifikation zu Testomatio exportiert wird
    Then werden die Schlüsselworte ins Englische übersetzt
