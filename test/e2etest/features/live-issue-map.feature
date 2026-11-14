@live
Feature: Live GitHub Issues Map smoke test
  Exercise the unpacked extension in Chrome against the dedicated test repository.
  This scenario creates two marked issues and appends their references to one
  dedicated pull request. The created issues and pull request change are retained.

  Scenario: Create linked issues and link them to the dedicated pull request
    Given Chrome is started with the current unpacked Issue Map extension
    And I sign in to GitHub and configure the PAT for the dedicated repository
    When I open the Issues Map in the dedicated repository
    And I create a marked Analysis Result and its linked Countermeasure
    And I link the created issues to the dedicated pull request
    Then both created issues and the pull request appear together in the Issues Map
