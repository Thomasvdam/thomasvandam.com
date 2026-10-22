import type { Game } from "./game";
import { warningLit } from "./lighting";
import { RHINO_ROCK, rhinoRocks, solidRock } from "./rhino-rocks";

export const ROCK_FALL_TIME = .22;
export function rockFallHeight(remaining: number) {
	const t = Math.max(0, Math.min(1, 1 - remaining / ROCK_FALL_TIME));
	return 400 * (1 - t * t);
}

export function drawRhinoRocks(ctx: CanvasRenderingContext2D, game: Game) {
	ctx.save();
	for (const rock of rhinoRocks(game.boss)) {
		if (rock.health <= 0) continue;
		const solid = solidRock(rock), progress = Math.max(0, 1 - rock.remaining / RHINO_ROCK.warning);
		if (!solid && warningLit(game, rock)) {
			ctx.strokeStyle = "#efb17c"; ctx.fillStyle = "#db794b22"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.arc(rock.x, rock.y, RHINO_ROCK.blast, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(rock.x - 9, rock.y - 9); ctx.lineTo(rock.x + 9, rock.y + 9); ctx.moveTo(rock.x + 9, rock.y - 9); ctx.lineTo(rock.x - 9, rock.y + 9); ctx.stroke();
		}
		ctx.fillStyle = `rgba(5,10,9,${solid ? .55 : .1 + progress * .35})`;
		ctx.beginPath(); ctx.ellipse(rock.x, rock.y + 6, 32, 21, 0, 0, Math.PI * 2); ctx.fill();
		// Keep the full warning, then drop from the ceiling in the final 220ms.
		if (!solid && rock.remaining > ROCK_FALL_TIME) continue;
		const height = solid ? 0 : rockFallHeight(rock.remaining), age = game.time - rock.landedAt;
		if (!solid) {
			ctx.strokeStyle = "#d5c29a88"; ctx.lineWidth = 3;
			for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(rock.x + i * 16, rock.y - height - 92 + i * 7); ctx.lineTo(rock.x + i * 16, rock.y - height - 32); ctx.stroke(); }
		}
		ctx.save(); ctx.translate(rock.x, rock.y - height);
		if (solid && age >= 0 && age < .1) { const squash = 1 - age / .1; ctx.scale(1 + squash * .12, 1 - squash * .18); }
		const flash = game.time - rock.hitAt < .1;
		ctx.fillStyle = flash ? "#ddd8ba" : "#5c6154"; ctx.strokeStyle = "#292e28"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(-29, 9); ctx.lineTo(-23, -16); ctx.lineTo(-8, -31); ctx.lineTo(17, -27); ctx.lineTo(29, -7); ctx.lineTo(26, 17); ctx.lineTo(5, 26); ctx.lineTo(-21, 23); ctx.closePath(); ctx.fill(); ctx.stroke();
		ctx.fillStyle = flash ? "#f4ebcf" : "#92917a";
		ctx.beginPath(); ctx.moveTo(-23, -16); ctx.lineTo(-8, -31); ctx.lineTo(17, -27); ctx.lineTo(5, -3); ctx.lineTo(-9, 3); ctx.closePath(); ctx.fill();
		ctx.fillStyle = "#3b443b"; ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(29, -7); ctx.lineTo(26, 17); ctx.lineTo(5, 26); ctx.closePath(); ctx.fill();
		if (rock.health < RHINO_ROCK.health) {
			ctx.strokeStyle = "#202b24"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(-2, -8); ctx.lineTo(-12, 4); ctx.lineTo(0, 12); ctx.lineTo(-3, 23); ctx.stroke();
		}
		ctx.restore();
		if (solid && age >= 0 && age < .35) {
			const t = age / .35;
			ctx.strokeStyle = `rgba(232,211,172,${1 - t})`; ctx.lineWidth = 6 * (1 - t); ctx.beginPath(); ctx.arc(rock.x, rock.y, RHINO_ROCK.blast * Math.min(1, age / .12), 0, Math.PI * 2); ctx.stroke();
			ctx.save(); ctx.globalAlpha *= 1 - t;
			for (let i = 0; i < 8; i++) {
				const angle = i * Math.PI / 4 + rock.id, reach = 18 + t * 42;
				const x = rock.x + Math.cos(angle) * reach, y = rock.y + Math.sin(angle) * reach * .6;
				ctx.fillStyle = "#b6a18355"; ctx.beginPath(); ctx.ellipse(x, y, 9 + t * 5, 5 + t * 3, angle, 0, Math.PI * 2); ctx.fill();
				ctx.fillStyle = "#a3a18a"; ctx.fillRect(x, y - Math.sin(t * Math.PI) * 20, 4 * (1 - t), 3 * (1 - t));
			}
			ctx.restore();
		}
	}
	ctx.restore();
}
