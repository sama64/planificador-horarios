# Uso
Para usar enviar un archivo con las materias correlativas y los horarios disponibles para cada materia.
No usar dos archivos distintos de ofertas de materias al mismo tiempo ya que el sistema no sabe cuál elegir.

Devuelve un json con el formato correcto. Se probó con gemini 2.5 flash.

# Prompt abajo

Your goal is to parse college class information, including their schedule options and prerequisites, from the provided image.

**Output Format:**
You must respond **only** with a JSON array of class objects. Each class object should adhere to the following structure:

```json
[
  {
    "id": number,         // Unique integer identifier for the class (from the 'N°' column in the main curriculum table).
    "name": "string",        // Full name of the class (from the 'MATERIA' column in the main curriculum table).
    "hours": number,         // Total hours for the class. Assume: 1 hour per 15 minutes of class time.
                             // Total hours = (Weekly Class Hours) * 16.
                             // Weekly Class Hours is the sum of the duration of each unique schedule option.
    "scheduleOptions": [     // An array of available schedule options for the class.
      {
        "schedule": [        // A single schedule option, consisting of one or more daily time slots.
          {
            "day": "string",   // Day of the week (e.g., "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado")
            "startTime": "string", // Start time in "HH:MM" format (24-hour)
            "endTime": "string"    // End time in "HH:MM" format (24-hour)
          }
        ]
      }
    ],
    "prerequisites": [       // An array of `id` (number) for prerequisite classes.
      number                 // The 'N°' of the prerequisite class from the main curriculum table.
                             // If no prerequisites, the array should be empty `[]`.
    ]
  }
]
```

**Key Rules for Parsing:**

*   **`id` field:** Use the `N°` value from the first table (main curriculum page) directly as the unique integer `id` for each class.
*   **Each line under 'DÍAS' represents a separate `scheduleOption`:** If a class has multiple entries in the 'DÍAS' column, even if they occur on the same day but different times, or different days, each line corresponds to a distinct `scheduleOption`.
    *   **Example 1 (Single Day, Single Time Slot):** If a class entry shows "Miércoles 14:00 a 18:00", this is one `scheduleOption`.
    *   **Example 2 (Multiple Days, Single Time Slot per day):** If a class entry shows "Lunes y Jueves 14:00 a 18:00", this is one `scheduleOption` with two `day` entries within its `schedule` array.
    *   **Example 3 (Same Day, Different Time Slots on separate lines):** If a class shows:
        ```
        Martes 18:30 a 20:30
        Martes 20:30 a 22:30
        ```
        This means there are *two separate `scheduleOptions`*. The first `scheduleOption` contains the "Martes 18:30 a 20:30" slot, and the second `scheduleOption` contains the "Martes 20:30 a 22:30" slot.
    *   **Example 4 (Mixed Days and Times on separate lines):** If a class shows:
        ```
        Lunes 18:30 a 22:30
        Jueves 18:30 a 22:30
        ```
        This means there are *two separate `scheduleOptions`*. The first `scheduleOption` contains the "Lunes 18:30 a 22:30" slot, and the second `scheduleOption` contains the "Jueves 18:30 a 22:30" slot.
    *   **Example 5 (Mixed Days and Times, some on one line, some on separate):** If a class shows:
        ```
        Lunes y Jueves 14:00 a 18:00
        Martes 18:30 a 22:30
        ```
        This means there are *two separate `scheduleOptions`*. The first `scheduleOption` contains both the "Lunes 14:00 a 18:00" and "Jueves 14:00 a 18:00" slots. The second `scheduleOption` contains the "Martes 18:30 a 22:30" slot.
*   **Mapping Schedules to Classes:** To correctly associate schedule entries (from pages 2 and 3) with classes (from page 1), use both the `CÓDIGO` and `MATERIA` (class name) from the schedule table to find the corresponding `N°` in the main curriculum table. This is important because some `CÓDIGO`s may appear multiple times for different class names.
*   **Prerequisites:** Extract prerequisites from the "Correlativas" column in the plan de estudios (first table). These are `N°` values. Convert them to numbers and list them in the `prerequisites` array. If "Ninguna" or empty, the array should be empty `[]`.