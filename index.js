// index.js

import express from 'express';
import csvParser from 'csv-parser';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import csv from 'csv-parser';
import { Configuration, OpenAIApi } from 'openai'

import { removeWhiteSpaceExceptInQuotes, createInitialPrompt } from './util.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());


app.get('/v1/sailaway', async (req, res) => {

	// TODO: replace with req prompt
	const tempReq = "You are a sail generator. List the functions you'll need to create a home loan form in appian sail."

	// TODO: replace with env variable
	const configuration = new Configuration({
		apiKey: "",
	});
	const openai = new OpenAIApi(configuration);

	const completion = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: [{ role: "system", content: createInitialPrompt("home loan form") }],
	});


	const mapPromise = new Promise((resolve, reject) => {
		// Loading data from  csv
		const map = new Map();
		fs.createReadStream('output.csv')
			.pipe(csv())
			.on('data', (row) => {
				// Extract the values of the "Function Name", "Param Names", and "Param Descriptions" columns
				const functionName = row['Function Name'];
				const paramNames = row['Param Names'];
				const paramDescriptions = row['Param Descriptions'];

				// Add the extracted values to the map
				map.set(functionName, {
					paramNames: paramNames,
					paramDescriptions: paramDescriptions
				});
			})
			.on('end', () => {
				// Resolve the Promise with the Map object
				resolve(map);
			})
			.on('error', (error) => {
				// Reject the Promise with an error if there was a problem reading the file
				reject(error);
			});
	});

	const [apiData, map] = await Promise.all([completion.data, mapPromise]);

	//TODO: api error handle

	const functionList = JSON.parse(apiData.choices[0].message["content"])["functions"]
	functionList.map(func => {
		console.log(func)
		console.log(map.get(func + "()"));
	})

	res.send()
});








app.get('/v1/sail-gen', async (req, res) => {
	const filePath = './sail_files/recipes.csv';
	const outputFilePathJson = './sail_files/modified_recipes.json';
	const outputFilePathCSV = './sail_files/modified_recipes.csv';
	try {
		const data = await readCSVFile(filePath);
		await writeCSVFile(outputFilePathJson, data);
		await writeJSONFile(outputFilePathJson, data);
		res.status(200).json({ message: 'CSV file processed successfully', data });
	} catch (error) {
		res.status(500).json({ message: 'Error processing the CSV file', error });
	}
});

const readCSVFile = (filePath) => {
	return new Promise((resolve, reject) => {
		const data = [];

		let i = 0;
		fs.createReadStream(filePath)
			.pipe(csvParser())
			.on('data', (row) => {
				data.push({ id: i++, keys: row["keys"], values: removeWhiteSpaceExceptInQuotes(row["values"]) });
			})
			.on('end', () => resolve(data))
			.on('error', (error) => reject(error));
	});
};

const writeCSVFile = async (filePath, data) => {
	console.log(data);

	const csvWriter = createCsvWriter({
		path: filePath,
		header: [
			{ id: 'id', title: 'ID' },
			{ id: 'keys', title: 'KEYS' },
			{ id: 'values', title: 'VALUES' }
		]
	});

	await csvWriter.writeRecords(data);
};

const writeJSONFile = async (outputFilePath, data) => {
	await fs.promises.writeFile(outputFilePath, JSON.stringify(data, null, 2));
};

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});