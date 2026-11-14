Feature: GitHub Issues Map
  The repository Issues Map presents linked FMEA issues and pull requests,
  and supports the documented creation and linking workflows.

  Scenario: Display parsed issues and a linked pull request without the relationship warning
    Given the repository has Analysis Result issue 2 and Countermeasure issue 10 linked to it
    And pull request 20 references issues 2 and 10
    When I open the Issues Map
    Then the Analysis Result, Countermeasure, and pull request are shown in one row
    And the one-to-one relationship warning is hidden
    And removed Countermeasure fields are not displayed

  Scenario: Display the relationship warning when one PR links multiple Countermeasures
    Given the repository has Analysis Result issue 2 and Countermeasures 10 and 11 linked to it
    And pull request 20 references Analysis Result 2 and Countermeasures 10 and 11
    When I open the Issues Map
    Then the one-to-one relationship warning is displayed

  Scenario: Return to the repository page with browser back navigation
    Given the repository has Analysis Result issue 2 and Countermeasure issue 10 linked to it
    And pull request 20 references issues 2 and 10
    When I open the Issues Map
    And I go back to the repository page
    Then the repository content is visible and the Issues Map is closed

  Scenario: Do not show the Issues Map without all repository navigation tabs
    Given the repository page does not have a Pull requests navigation tab
    When the content script is loaded there with the Issues Map route active
    Then the Issues Map tab and view are not displayed

  Scenario: Expand one pull request into each issue combination
    Given the repository has Analysis Results 2 and 4 and Countermeasure 10 linked to both
    And pull request 20 references issues 2, 4, and 10
    When I open the Issues Map
    Then pull request 20 is shown once for Analysis Result 2 and once for Analysis Result 4

  Scenario: Create a Countermeasure from the map
    Given the repository has no labeled issues or pull requests
    When I open the Issues Map
    Then the one-to-one relationship warning is hidden
    And I create a Countermeasure titled "Replace the bearing"
    Then the creation succeeds and the new Countermeasure appears in the map

  Scenario: Edit an issue from its number link
    Given the repository has Analysis Result issue 2 and Countermeasure issue 10 linked to it
    And pull request 20 references issues 2 and 10
    When I open the Issues Map
    And I edit Analysis Result issue 2 from its number link
    Then the changed issue content appears in the map

  Scenario: Link an existing pull request to issues
    Given the repository has Analysis Result issue 2 and Countermeasure issue 10 linked to it
    And pull request 20 has no issue references
    When I open the Issues Map
    And I link the pull request in the map to the displayed issues
    Then pull request 20 is shown in the linked issue row
