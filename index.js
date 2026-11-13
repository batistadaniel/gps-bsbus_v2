
import express from "express";
import cors from "cors";
import { performance } from "perf_hooks";

const PORT = 3000;
const app = express();

app.use(cors());
app.use(express.json());

// ROTA DE VEÍCULOS - V2
app.use("/veiculos", async (req, res) => {
  try {
    const inicio = performance.now();

    // Nova API do DFTrans
    const url = "https://www.sistemas.dftrans.df.gov.br/service/gps/operadora/3450";

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erro na API DFTrans: ${response.status}`);
    }

    const data = await response.json();

    // Formatando os veículos para manter o padrão da V1
    const veiculosFormatados = data.veiculos.map((veiculo) => {

      // Convertendo timestamp para data e hora
      const dataHora = new Date(veiculo.horario);

      const dataBR = dataHora.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo"
      });

      const hora = dataHora.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour12: false
      });

      return {
        prefixo: veiculo.numero,
        data: dataBR,
        hora: hora,

        // A nova API não fornece esses campos
        dataProgramada: null,
        horaProgramada: null,

        sentido: veiculo.velocidade?.valor === 0 ? "Ida" : "Volta",
        linha: veiculo.linha,
        direcao: veiculo.direcao,
        latitude: veiculo.localizacao?.latitude,
        longitude: veiculo.localizacao?.longitude
      };
    });

    const fim = performance.now();

    return res.json({
      tempo_execucao: `Tempo de execução: ${(fim - inicio).toFixed(2)} ms`,
      veiculos_total: veiculosFormatados.length,
      veiculos: veiculosFormatados
    });

  } catch (error) {
    console.error("Erro ao consultar veículos:", error);

    return res.status(500).json({
      erro: "Erro ao consultar veículos",
      detalhes: error.message
    });
  }
});

// ROTA DE ITINERÁRIOS - MANTIDA DA V1
app.use("/itinerario/:linha", async (req, res) => {
  try {
    const { linha } = req.params;

    const routesRes = await fetch("https://mobilibus.com/api/routes?origin=web&project_id=313");
    const routes = await routesRes.json();

    const route = routes.find(r => r.shortName === linha);

    if (!route) {
      return res.status(404).json({ erro: "Linha não encontrada" });
    }

    const routeId = route.routeId;

    const timetableRes = await fetch(
      `https://mobilibus.com/api/timetable?origin=web&v=2&project_id=313&route_id=${routeId}`
    );

    const timetableData = await timetableRes.json();
    const trips = timetableData.timetable?.trips || [];

    if (trips.length === 0) {
      return res.status(404).json({ erro: "Nenhum itinerário encontrado" });
    }

    const detalhesTrips = await Promise.all(
      trips.map(async (trip) => {
        const tripRes = await fetch(
          `https://mobilibus.com/api/trip-details?origin=web&v=2&trip_id=${trip.tripId}`
        );

        const tripData = await tripRes.json();

        return {
          tripId: trip.tripId,
          directionId: trip.directionId,
          nome: tripData.tripName,
          shape: tripData.shape,
          stops: tripData.stops
        };
      })
    );

    return res.json({
      linha: route.shortName,
      nome: route.longName,
      price: route.price,
      itinerarios: detalhesTrips
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: "Erro interno" });
  }
});

// Inicializando servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});
