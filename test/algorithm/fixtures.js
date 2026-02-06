export function basicFixtureClasses() {
  return [
    {
      id: 1,
      name: 'Matematica I',
      prerequisites: [],
      scheduleOptions: [
        {
          schedule: [{ day: 'Lunes', startTime: '08:00', endTime: '10:00' }]
        },
        {
          schedule: [{ day: 'Lunes', startTime: '14:00', endTime: '16:00' }]
        }
      ]
    },
    {
      id: 2,
      name: 'Fisica I',
      prerequisites: [1],
      scheduleOptions: [
        {
          schedule: [{ day: 'Lunes', startTime: '08:00', endTime: '10:00' }]
        },
        {
          schedule: [{ day: 'Martes', startTime: '08:00', endTime: '10:00' }]
        }
      ]
    },
    {
      id: 3,
      name: 'Ingles',
      prerequisites: [],
      scheduleOptions: [
        {
          schedule: [{ day: 'Lunes', startTime: '08:30', endTime: '09:30' }]
        },
        {
          schedule: [{ day: 'Miercoles', startTime: '08:00', endTime: '10:00' }]
        }
      ]
    },
    {
      id: 4,
      name: 'Proyecto',
      prerequisites: [2, 3],
      scheduleOptions: [
        {
          schedule: [{ day: 'Jueves', startTime: '10:00', endTime: '12:00' }]
        }
      ]
    }
  ];
}

export function conflictingNoPrereqFixture() {
  return [
    {
      id: 1,
      name: 'A',
      prerequisites: [],
      scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: '08:00', endTime: '10:00' }] }]
    },
    {
      id: 2,
      name: 'B',
      prerequisites: [],
      scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: '09:00', endTime: '11:00' }] }]
    },
    {
      id: 3,
      name: 'C',
      prerequisites: [],
      scheduleOptions: [{ schedule: [{ day: 'Martes', startTime: '08:00', endTime: '10:00' }] }]
    }
  ];
}
