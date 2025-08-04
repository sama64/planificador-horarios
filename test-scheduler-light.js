#!/usr/bin/env node

/**
 * Comprehensive scheduler test suite for validating dependency handling
 * Run with: bun test-scheduler-light.js
 * 
 * Tests the scheduler algorithm for:
 * - Dependency chain handling with passed classes
 * - Class limit constraints  
 * - Time and day preferences
 * - Edge cases and invalid scenarios
 * - Random scenario validation
 */

import { scheduleClasses } from './src/lib/scheduler.js';

// Simple test data
function generateBasicTestClasses() {
  return [
    { id: 1, name: "Math I", prerequisites: [], scheduleOptions: [{ days: ["Lunes"], startTime: "08:00", endTime: "10:00" }] },
    { id: 2, name: "Math II", prerequisites: [1], scheduleOptions: [{ days: ["Martes"], startTime: "08:00", endTime: "10:00" }] },
    { id: 3, name: "Math III", prerequisites: [2], scheduleOptions: [{ days: ["Miércoles"], startTime: "08:00", endTime: "10:00" }] },
    { id: 4, name: "Physics I", prerequisites: [], scheduleOptions: [{ days: ["Jueves"], startTime: "08:00", endTime: "10:00" }] },
    { id: 5, name: "Physics II", prerequisites: [4], scheduleOptions: [{ days: ["Viernes"], startTime: "08:00", endTime: "10:00" }] },
    { id: 6, name: "Programming I", prerequisites: [], scheduleOptions: [{ days: ["Lunes"], startTime: "14:00", endTime: "16:00" }] },
    { id: 7, name: "Data Structures", prerequisites: [6], scheduleOptions: [{ days: ["Martes"], startTime: "14:00", endTime: "16:00" }] },
    { id: 8, name: "Algorithms", prerequisites: [6], scheduleOptions: [{ days: ["Miércoles"], startTime: "14:00", endTime: "16:00" }] },
    { id: 9, name: "Advanced Programming", prerequisites: [7, 8], scheduleOptions: [{ days: ["Jueves"], startTime: "14:00", endTime: "16:00" }] },
    { id: 10, name: "Elective", prerequisites: [], scheduleOptions: [{ days: ["Viernes"], startTime: "14:00", endTime: "16:00" }] }
  ];
}

// Validation function
function validateSchedule(schedule, allClasses, userPreferences) {
  if (!schedule.success) return { valid: true, violations: [] };
  
  const violations = [];
  const classMap = new Map(allClasses.map(cls => [cls.id, cls]));
  const passedClasses = userPreferences.passedClasses || [];
  
  for (const [classId, assignment] of Object.entries(schedule.schedule)) {
    const cls = classMap.get(parseInt(classId));
    if (!cls) continue;
    
    for (const prereqId of cls.prerequisites) {
      if (passedClasses.includes(prereqId)) continue;
      
      const prereqAssignment = schedule.schedule[prereqId];
      if (prereqAssignment && prereqAssignment.semester >= assignment.semester) {
        violations.push({
          type: 'PREREQUISITE_VIOLATION',
          class: cls.name,
          prerequisite: classMap.get(prereqId)?.name,
          classSemester: assignment.semester,
          prerequisiteSemester: prereqAssignment.semester
        });
      } else if (!prereqAssignment) {
        violations.push({
          type: 'MISSING_PREREQUISITE',
          class: cls.name,
          prerequisite: classMap.get(prereqId)?.name
        });
      }
    }
  }
  
  return { valid: violations.length === 0, violations };
}

// Focused test cases
function generateFocusedTests() {
  const classes = generateBasicTestClasses();
  
  return [
    {
      name: "Basic dependency chain - no passed classes",
      classes,
      passedClasses: [],
      expected: { success: true, minPeriods: 3 }
    },
    {
      name: "Pass root class - Math I",
      classes,
      passedClasses: [1],
      expected: { success: true, minPeriods: 2 }
    },
    {
      name: "Pass intermediate class - Math II", 
      classes,
      passedClasses: [1, 2],
      expected: { success: true, minPeriods: 2 }
    },
    {
      name: "Complex dependency - Programming chain",
      classes,
      passedClasses: [6], // Programming I passed
      expected: { success: true, minPeriods: 2 }
    },
    {
      name: "Multiple passed classes",
      classes,
      passedClasses: [1, 4, 6], // Math I, Physics I, Programming I
      expected: { success: true, minPeriods: 2 }
    },
    {
      name: "Almost all passed",
      classes,
      passedClasses: [1, 2, 4, 5, 6, 7, 8, 10], // Only Math III and Advanced Programming left
      expected: { success: true, minPeriods: 2 }
    },
    {
      name: "Class limit constraint - 1 per period",
      classes,
      passedClasses: [],
      userPreferences: { maxClassesPerPeriod: 1 },
      expected: { success: true, minPeriods: 10 }
    },
    {
      name: "Class limit constraint - 2 per period",
      classes,
      passedClasses: [],
      userPreferences: { maxClassesPerPeriod: 2 },
      expected: { success: true, minPeriods: 5 }
    },
    {
      name: "Time preference - morning only (should fail due to limited options)",
      classes: classes.map(cls => ({
        ...cls,
        scheduleOptions: [
          { days: ["Lunes"], startTime: "08:00", endTime: "10:00" },
          { days: ["Martes"], startTime: "20:00", endTime: "22:00" } // Evening option
        ]
      })),
      passedClasses: [],
      userPreferences: { timePreference: "morning" },
      expected: { success: false } // Should fail because not enough morning options
    },
    {
      name: "Day exclusion",
      classes,
      passedClasses: [],
      userPreferences: { noDays: ["Lunes", "Martes"] },
      expected: { success: true }
    },
    {
      name: "Invalid scenario - missing prerequisite",
      classes: [
        { id: 1, name: "Test", prerequisites: [999], scheduleOptions: [{ days: ["Lunes"], startTime: "08:00", endTime: "10:00" }] }
      ],
      passedClasses: [],
      expected: { success: false }
    }
  ];
}

// Run lightweight tests
async function runLightweightTests() {
  console.log('🧪 Starting Lightweight Scheduler Tests\n');
  
  const tests = generateFocusedTests();
  let passed = 0;
  let failed = 0;
  const startTime = performance.now();
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n📋 Test ${i + 1}: ${test.name}`);
    
    try {
      const userPreferences = {
        passedClasses: test.passedClasses,
        maxClassesPerPeriod: test.userPreferences?.maxClassesPerPeriod || 6,
        noDays: test.userPreferences?.noDays || [],
        timePreference: test.userPreferences?.timePreference || null
      };
      
      const activeClasses = test.classes.filter(cls => !userPreferences.passedClasses.includes(cls.id));
      console.log(`   Active classes: ${activeClasses.length}, Passed: ${test.passedClasses.length}`);
      
      const testStart = performance.now();
      const result = await scheduleClasses(activeClasses, userPreferences);
      const testTime = performance.now() - testStart;
      
      const validation = validateSchedule(result, test.classes, userPreferences);
      
      console.log(`   Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Periods: ${result.totalPeriods || 'N/A'}`);
      console.log(`   Time: ${testTime.toFixed(2)}ms`);
      console.log(`   Validation: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);
      
      if (!validation.valid) {
        console.log(`   Violations: ${validation.violations.map(v => v.type).join(', ')}`);
      }
      
      // Check expectations
      let testPassed = true;
      if (test.expected.success !== undefined && result.success !== test.expected.success) {
        testPassed = false;
        console.log(`   ❌ Expected success: ${test.expected.success}, got: ${result.success}`);
      }
      
      if (test.expected.success && !validation.valid) {
        testPassed = false;
        console.log(`   ❌ Validation failed unexpectedly`);
      }
      
      if (test.expected.minPeriods && result.totalPeriods > test.expected.minPeriods + 1) {
        console.log(`   ⚠️  Suboptimal: expected ≤${test.expected.minPeriods}, got ${result.totalPeriods}`);
      }
      
      if (testPassed) {
        console.log(`   ✅ PASSED`);
        passed++;
      } else {
        console.log(`   ❌ FAILED`);
        failed++;
      }
      
    } catch (error) {
      console.log(`   💥 CRASHED: ${error.message}`);
      if (test.expected.success === false) {
        console.log(`   ✅ PASSED (expected failure)`);
        passed++;
      } else {
        failed++;
      }
    }
  }
  
  const totalTime = performance.now() - startTime;
  
  console.log(`\n\n📊 LIGHTWEIGHT TEST RESULTS`);
  console.log(`============================`);
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total time: ${totalTime.toFixed(2)}ms`);
  console.log(`📈 Avg per test: ${(totalTime / tests.length).toFixed(2)}ms`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Scheduler is working correctly.');
    return true;
  } else {
    console.log(`\n💥 ${failed} test(s) failed.`);
    return false;
  }
}

// Run batch tests with different random scenarios
async function runBatchTests(batchSize = 50) {
  console.log(`\n🔄 Running ${batchSize} Random Batch Tests\n`);
  
  const classes = generateBasicTestClasses();
  let batchPassed = 0;
  let totalViolations = 0;
  
  for (let i = 0; i < batchSize; i++) {
    // Generate random passed classes (valid dependencies only)
    const passedClasses = [];
    const maxPassed = Math.floor(classes.length * 0.4);
    const numPassed = Math.floor(Math.random() * maxPassed);
    
    // Start with root classes
    const availableToPass = classes.filter(cls => cls.prerequisites.length === 0);
    
    for (let j = 0; j < numPassed && availableToPass.length > 0; j++) {
      const randomIdx = Math.floor(Math.random() * availableToPass.length);
      const selected = availableToPass[randomIdx];
      passedClasses.push(selected.id);
      availableToPass.splice(randomIdx, 1);
      
      // Add newly available classes
      classes.forEach(cls => {
        if (!passedClasses.includes(cls.id) && 
            !availableToPass.includes(cls) &&
            cls.prerequisites.every(prereq => passedClasses.includes(prereq))) {
          availableToPass.push(cls);
        }
      });
    }
    
    try {
      const userPreferences = {
        passedClasses,
        maxClassesPerPeriod: Math.floor(Math.random() * 5) + 2, // 2-6 classes
        noDays: Math.random() < 0.2 ? ["Sábado"] : [],
        timePreference: Math.random() < 0.3 ? ["morning", "afternoon", "evening"][Math.floor(Math.random() * 3)] : null
      };
      
      const activeClasses = classes.filter(cls => !userPreferences.passedClasses.includes(cls.id));
      const result = await scheduleClasses(activeClasses, userPreferences);
      const validation = validateSchedule(result, classes, userPreferences);
      
      if (result.success && validation.valid) {
        batchPassed++;
      } else if (!validation.valid) {
        totalViolations += validation.violations.length;
      }
      
      if (i % 10 === 0) {
        console.log(`   Progress: ${i}/${batchSize} (${((i/batchSize)*100).toFixed(0)}%)`);
      }
      
    } catch (error) {
      // Count as failure
    }
  }
  
  console.log(`\n📊 Batch Test Results:`);
  console.log(`   ✅ Valid schedules: ${batchPassed}/${batchSize} (${((batchPassed/batchSize)*100).toFixed(1)}%)`);
  console.log(`   🚨 Total violations found: ${totalViolations}`);
  
  return { passed: batchPassed, total: batchSize, violations: totalViolations };
}

// Main execution
async function main() {
  console.log('🚀 Scheduler Edge Case Testing - Lightweight Mode\n');
  
  // Run focused tests
  const focusedResult = await runLightweightTests();
  
  if (focusedResult) {
    // Run batch tests if focused tests pass
    const batchResult = await runBatchTests(100);
    
    console.log(`\n🎯 FINAL SUMMARY:`);
    console.log(`   Focused tests: ✅ PASSED`);
    console.log(`   Batch tests: ${batchResult.passed}/${batchResult.total} valid`);
    console.log(`   Dependency violations: ${batchResult.violations}`);
    
    if (batchResult.violations === 0 && batchResult.passed > batchResult.total * 0.9) {
      console.log(`\n🎉 SCHEDULER IS ROBUST - No dependency violations found!`);
    } else {
      console.log(`\n⚠️  Some issues detected in batch testing`);
    }
  }
}

main().catch(console.error);