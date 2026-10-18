import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Builder, By, Key, until, Select } from 'selenium-webdriver';
import { toolchainEnvironment } from '../scripts/environment.mjs';

test(
  'native library saves through IPC, reloads persisted edits and supports archive undo',
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
    const typeText = async (element, value) => {
      // Separate key commands let the controlled input settle on slower runners.
      for (const character of value) await element.sendKeys(character);
      assert.equal(await element.getAttribute('value'), value);
    };
    const waitForSave = () =>
      driver.wait(
        async () =>
          (await driver.findElements(By.css('[role="dialog"]'))).length === 0,
        15_000,
        'The game editor should close only after persistence succeeds',
      );
    const findGame = async (value) => {
      await waitForSave();
      const search = await driver.findElement(By.css('input[type="search"]'));
      // Native clear() can omit input events and leave React state unchanged.
      await search.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
      await driver.wait(
        async () => (await search.getAttribute('value')) === '',
        5000,
        'Search must be empty before typing the next query',
      );
      await typeText(search, value);
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
      console.info('Native session created; entering a game.');
      await clickText('+ Add game');
      await typeText(await driver.findElement(By.name('title')), title);
      await typeText(await driver.findElement(By.name('platform')), 'PC');
      await typeText(await driver.findElement(By.name('minutes')), '90');
      await new Select(
        await driver.findElement(By.name('status')),
      ).selectByValue('completed');
      await new Select(
        await driver.findElement(By.name('rating')),
      ).selectByValue('4');
      await clickText('Save game');
      console.info('Save submitted; checking the stored game.');
      const game = await findGame(title);
      await game.click();
      assert.equal(
        await driver.findElement(By.name('minutes')).getAttribute('value'),
        '90',
      );
      const notes = await driver.findElement(By.name('notes'));
      await typeText(
        notes,
        'Persistence verified after reloading the interface.',
      );
      await clickText('Save game');
      await findGame(title);
      console.info(
        'Edit saved; reloading the renderer to read through IPC again.',
      );
      await driver.navigate().refresh();
      await (await findGame(title)).click();
      assert.equal(
        await driver.findElement(By.name('notes')).getAttribute('value'),
        'Persistence verified after reloading the interface.',
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
            path.join(reportPath, 'desktop-state.json'),
            JSON.stringify(
              {
                expectedTitle: title,
                search: await driver
                  .findElement(By.css('input[type="search"]'))
                  .getAttribute('value'),
                visibleText: await driver.findElement(By.css('body')).getText(),
              },
              null,
              2,
            ),
          );
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
