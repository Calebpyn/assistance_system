import React, { useState } from "react";
import Papa from "papaparse";

type RegistroEmpleado = {
  id: string;
  nombre: string;
  departamento: string;
  dias: string[][]; // cada día tiene lista de marcas ["08:26", "16:33"]
};

type ResultadoTurno = {
  empleado: string;
  turnosTotales: number;
  turnosConBono: number;
};

const VentanasPorTurno = [
  { nombre: "entrada", hora: "8:30", margenMin: -120, margenMax: 120 },
  { nombre: "salida", hora: "1:30", margenMin: -120, margenMax: 120 },
  { nombre: "entrada", hora: "16:30", margenMin: -120, margenMax: 120 }, // ejemplo en minutos
  { nombre: "salida", hora: "21:30", margenMin: -120, margenMax: 120 },
];

const convertirAHoras = (hora: string): number => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

const mapCSVtoEmpleados = (csvData: string[][]): RegistroEmpleado[] => {
  const empleados: RegistroEmpleado[] = [];

  let i = 0;
  while (i < csvData.length) {
    const fila = csvData[i];

    if (fila[0] === "ID.") {
      // Extraemos ID, Nombre y Departamento
      const id = fila[2];
      const nombre = fila[11] || "Unknown";
      const departamento = fila[20] || "Unknown";

      // La fila de marcas de huella normalmente está 5 filas abajo
      const marcasFila = csvData[i + 3];
      const dias: string[][] = marcasFila
        ? marcasFila.map((celda) => {
            if (!celda) return [];
            return celda
              .split("\n")
              .map((h) => h.trim())
              .filter(Boolean);
          })
        : [];

      empleados.push({ id, nombre, departamento, dias });

      // Saltamos a la siguiente sección de empleado
      i += 4;
    } else {
      i++;
    }
  }

  return empleados;
};

function ComponenteAsistencia() {
  const [empleados, setEmpleados] = useState<RegistroEmpleado[]>([]);
  const [resultado, setResultado] = useState<ResultadoTurno | null>(null);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<string>("");

  const [shifts, setShifts] = useState<any[]>([]);

  const [range, setRange] = useState<string>("");

  const [sueldo, setSueldo] = useState<number>(0);
  const [bono, setBono] = useState<number>(0);

  const [total, setTotal] = useState<number>(0);
  const [totalBono, setTotalBono] = useState<number>(0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        console.log(results.data);
        const data = results.data as string[][];
        setRange(data[1][2]);
        const empleados = mapCSVtoEmpleados(data);
        console.log(empleados);
        setEmpleados(empleados);
      },
      header: false,
    });
  };

  function parseDateRange(range: string): [Date, Date] {
    const [startStr, endStr] = range.split("~").map((s) => s.trim());

    const [startDay, startMonth, startYear] = startStr.split("/").map(Number);
    const [endDay, endMonth, endYear] = endStr.split("/").map(Number);

    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);

    return [startDate, endDate];
  }

  function mapShiftsWithDates(
    start: Date,
    end: Date,
    shiftsPerDay: string[][]
  ) {
    const result: { date: string; weekday: string; shifts: string[] }[] = [];

    const weekdays = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];

    let current = new Date(start);
    let i = 0;

    while (current <= end) {
      result.push({
        date: current.toISOString().split("T")[0], // formato YYYY-MM-DD
        weekday: weekdays[current.getDay()],
        shifts: shiftsPerDay[i] || [],
      });

      current.setDate(current.getDate() + 1);
      i++;
    }

    return result;
  }

  const calcularTurnos = (empleado: RegistroEmpleado) => {
    let turnosTotales = 0;
    let turnosConBono = 0;

    console.log(empleado.nombre);

    console.log(parseDateRange(range));
    setShifts(
      mapShiftsWithDates(
        parseDateRange(range)[0],
        parseDateRange(range)[1],
        empleado.dias
      )
    );

    empleado.dias.forEach((marcas) => {
      marcas.forEach((hora) => {
        const minRegistro = convertirAHoras(hora);
        VentanasPorTurno.forEach((ventana) => {
          const minVentana = convertirAHoras(ventana.hora) + ventana.margenMin;
          const maxVentana = convertirAHoras(ventana.hora) + ventana.margenMax;
          if (minRegistro >= minVentana && minRegistro <= maxVentana) {
            if (ventana.nombre === "entrada") {
              turnosTotales++;
              if (minRegistro <= convertirAHoras(ventana.hora) + 5) {
                console.log("Bono");
                turnosConBono++;
              }
            }
            // if (ventana.nombre === "salida") salidaValida = true;
          }
        });
      });

      //Agregar un && salidaValida en caso de verificar salida
      //   if (entradaValida) {
      //     turnosTotales++;
      //     if (bono) turnosConBono++;
      //   }
    });

    setResultado({
      empleado: empleado.nombre,
      turnosTotales,
      turnosConBono,
    });
  };

  const calcularTotal = () => {
    setTotal(resultado?.turnosTotales! * sueldo);
    setTotalBono(resultado?.turnosConBono! * bono);
  };

  const checkPunctuality = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const minutes = h * 60 + m;

    // horarios en minutos
    const morningEntry = 8 * 60 + 35; // 08:30
    const eveningEntry = 16 * 60 + 35; // 16:30

    // rango puntualidad: [entrada-5, entrada]

    let isMorningPunctual = false;
    let isEveningPunctual = false;

    if (6 * 60 + 30 <= minutes && minutes <= 10 * 60 + 30) {
      isMorningPunctual = minutes <= morningEntry;
    }

    if (14 * 60 + 30 <= minutes && minutes <= 18 * 60 + 30) {
      isEveningPunctual = minutes <= eveningEntry;
    }

    return isMorningPunctual || isEveningPunctual;
  };

  return (
    <div className="p-5 w-full flex flex-col justify-center items-center">
      <span className="w-full flex justify-center items-center mb-5">
        <h1 className="font-black">Calculadora de Turnos</h1>
        <span className="ml-5">{range}</span>
      </span>

      <span className="flex justify-between items-center w-full">
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="bg-zinc-300 w-[200px] flex justify-center items-center p-3 rounded-[10px] shadow-2xl hover:scale-105 tr cursor-pointer"
        />
        <select
          onChange={(e) => setEmpleadoSeleccionado(e.target.value)}
          value={empleadoSeleccionado}
          className="border-[1px] p-3 rounded-[10px]"
        >
          <option value="">Selecciona un empleado</option>
          {empleados.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.nombre}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            const emp = empleados.find((e) => e.id === empleadoSeleccionado);
            if (emp) calcularTurnos(emp);
          }}
          className="bg-zinc-300 w-[200px] flex justify-center items-center p-3 rounded-[10px] shadow-2xl hover:scale-105 tr cursor-pointer"
        >
          Turnos
        </button>
      </span>

      {resultado && (
        <div className="w-full mt-5 flex flex-col justify-start items-start">
          <span className="w-full flex justify-start items-start gap-10">
            <span className="flex flex-col gap-1">
              <h2 className="font-bold">{resultado.empleado}</h2>
              <span>
                Turnos Totales:
                <input
                  type="number"
                  className="border-[1px] border-black p-1 w-[50px] ml-[10px]"
                  value={resultado.turnosTotales}
                  onChange={(e) =>
                    setResultado({
                      ...resultado,
                      turnosTotales: parseInt(e.target.value),
                    })
                  }
                />
              </span>
              <span>
                Turnos con Bono:{" "}
                <input
                  type="number"
                  className="border-[1px] border-black p-1 w-[50px] ml-[10px]"
                  value={resultado.turnosConBono}
                  onChange={(e) =>
                    setResultado({
                      ...resultado,
                      turnosConBono: parseInt(e.target.value),
                    })
                  }
                />
              </span>
            </span>

            <span>
              <span className="flex gap-3">
                <span>Sueldo: </span>
                <span className="flex flex-col gap-1">
                  <span>
                    <span>$ </span>
                    <input
                      type="number"
                      placeholder="Sueldo"
                      className="border-[1px] border-black w-[100px] p-1"
                      onChange={(e) => setSueldo(parseInt(e.target.value))}
                      value={sueldo}
                    />
                    <span> / Turno</span>
                  </span>
                  <span>
                    <span>$ </span>
                    <input
                      type="number"
                      placeholder="Bono"
                      className="border-[1px] border-black w-[100px] p-1"
                      onChange={(e) => setBono(parseInt(e.target.value))}
                      value={bono}
                    />
                    <span> / Turno</span>
                  </span>
                </span>
              </span>
            </span>

            <span>
              <button
                onClick={() => {
                  calcularTotal();
                }}
                className="bg-zinc-300 w-[200px] flex justify-center items-center p-3 rounded-[10px] shadow-2xl hover:scale-105 tr cursor-pointer"
              >
                Calcular
              </button>
            </span>

            <span className="flex flex-col">
              <span>Total / Turnos: ${total}</span>
              <span>Total / Bono: ${totalBono}</span>

              <span>Pago: ${total + totalBono}</span>
            </span>
          </span>

          <div className="w-full mt-3 flex flex-wrap gap-3">
            {shifts.map((shift, idx) => (
              <span
                key={idx}
                className="min-w-[200px] border-[1px] border-black"
              >
                <span className="w-full flex flex-col items-center bg-blue-300 border-b-[1px] border-black">
                  <span>{shift.weekday}</span>
                  <span>{shift.date}</span>
                </span>
                <span className="min-h-[10px] flex flex-col p-1">
                  {shift.shifts.map((reg: any, idx: number) => {
                    const punctual = checkPunctuality(reg);
                    return (
                      <span
                        key={idx}
                        className={punctual ? "text-green-500 font-bold" : ""}
                      >
                        {reg}
                      </span>
                    );
                  })}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ComponenteAsistencia;
