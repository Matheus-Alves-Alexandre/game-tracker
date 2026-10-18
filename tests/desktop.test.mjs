import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Builder, By, until, Select } from 'selenium-webdriver';
import { toolchainEnvironment } from '../scripts/environment.mjs';

test(
  'native library survives restart, supports editing and archive undo',
  { timeout: 180_000 },
  async () => {
    const reportPath = path.resolve('reports');
    await fs.mkdir(reportPath, { recursive: true });
    const application = path.resolve(
      process.env.DESKTOP_BINARY ?? 'src-tauri/target/debug/game-tracker.exe',
    );
    const nativeDriver = path.resolve('.tools/webdriver/msedgedriver.exe');
    const driverBinary = path.resolve(
      '.tools/tauri-driver/bin/tauri-driver.exe',
    );
    await Promise.all(
      [application, nativeDriver, driverBinary].map((file) => fs.access(file)),
    );
    const host = spawn(
      driverBinary,
      [
        '--native-driver',
        nativeDriver,
        '--port',
        '4444',
        '--native-port',
        '4445',
      ],
      {
        env: toolchainEnvironment(),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let hostError;
    host.on('error', (error) => {
      hostError = error;
    });
    const output = [];
    host.stdout.on('data', (data) => output.push(data.toString()));
    host.stderr.on('data', (data) => output.push(data.toString()));
    let driver;
    const title = `Desktop test ${randomUUID()}`;
    const connect = () =>
      new Builder()
        .usingServer('http://127.0.0.1:4444')
        .withCapabilities({
          'tauri:options': { application },
          browserName: 'wry',
        })
        .build();
    const clickText = async (text) =>
      (
        await driver.wait(
          until.elementLocated(
            By.xpath(`//button[normalize-space(.)='${text}']`),
          ),
          15_000,
        )
      ).click();
    const findGame = async (value) => {
      const search = await driver.findElement(By.css('input[type="search"]'));
      await search.clear();
      await search.sendKeys(value);
      return driver.wait(
        until.elementLocated(
          By.xpath(`//button[normalize-space(.)='${value}']`),
        ),
        15_000,
      );
    };
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (hostError) throw hostError;
        if (host.exitCode !== null)
          throw new Error(`tauri-driver exited: ${output.join('')}`);
        try {
          const response = await fetch('http://127.0.0.1:4444/status');
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {
          /* driver starting */
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      assert.ok(ready, 'Native WebDriver must start');
      driver = await connect();
      await clickText('+ Add game');
      await driver.findElement(By.name('title')).sendKeys(title);
      await driver.findElement(By.name('platform')).sendKeys('PC');
      await driver.findElement(By.name('minutes')).sendKeys('90');
      await new Select(
        await driver.findElement(By.name('status')),
      ).selectByValue('completed');
      await new Select(
        await driver.findElement(By.name('rating')),
      ).selectByValue('4');
      await clickText('Save game');
      const game = await findGame(title);
      await game.click();
      assert.equal(
        await driver.findElement(By.name('minutes')).getAttribute('value'),
        '90',
      );
      const notes = await driver.findElement(By.name('notes'));
      await notes.sendKeys('Persistence verified across native sessions.');
      await clickText('Save game');
      await findGame(title);
      await driver.quit();
      driver = await connect();
      await (await findGame(title)).click();
      assert.equal(
        await driver.findElement(By.name('notes')).getAttribute('value'),
        'Persistence verified across native sessions.',
      );
      assert.equal(
        await driver.findElement(By.name('rating')).getAttribute('value'),
        '4',
      );
      await clickText('Cancel');
      const archiveButton = () =>
        driver.findElement(By.css(`button[aria-label="Archive ${title}"]`));
      await (await archiveButton()).click();
      await driver.wait(
        until.elementLocated(
          By.xpath('//button[normalize-space(.)="Undo archive"]'),
        ),
        10_000,
      );
      await clickText('Undo archive');
      await findGame(title);
      await (await archiveButton()).click();
      await fs.writeFile(
        path.join(reportPath, 'desktop-success.png'),
        await driver.takeScreenshot(),
        'base64',
      );
    } catch (error) {
      if (driver) {
        try {
          await fs.writeFile(
            path.join(reportPath, 'desktop-failure.png'),
            await driver.takeScreenshot(),
            'base64',
          );
        } catch {
          /* preserve original failure */
        }
      }
      throw error;
    } finally {
      if (driver) {
        try {
          await driver.quit();
        } catch {
          /* host may already have exited */
        }
      }
      host.kill();
      await fs.writeFile(
        path.join(reportPath, 'desktop-driver.log'),
        output.join(''),
      );
    }
  },
);
